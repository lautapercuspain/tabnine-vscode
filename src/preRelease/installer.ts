import * as semver from "semver";
import { commands, Uri } from "vscode";
import {
  BETA_CHANNEL_MESSAGE_SHOWN_KEY,
  INSTALL_COMMAND,
  LATEST_RELEASE_URL,
} from "../globals/consts";
import {
  downloadFileToDestination,
  downloadFileToStr,
} from "../utils/download.utils";
import tabnineExtensionProperties from "../globals/tabnineExtensionProperties";
import createTempFileWithPostfix from "../utils/file.utils";
import showMessage from "./messages";
import {
  getAvailableAlphaVersion,
  getCurrentVersion,
  isPreReleaseChannelSupported,
  updatePersistedAlphaVersion,
  userConsumesPreReleaseChannelUpdates,
  userConsumesProposedAlphaUpdates,
} from "./versions";
import { ExtensionContext, GitHubReleaseResponse } from "./types";
import { Capability, isCapabilityEnabled } from "../capabilities/capabilities";

export const PROPOSED_ALPHA_VERSION = "9999.9999.9999";
export const PROPOSED_ALPHA_ARTIFACTS_URL = `https://github.com/codota/tabnine-vscode/releases/download/v${PROPOSED_ALPHA_VERSION}/tabnine-vscode-${PROPOSED_ALPHA_VERSION}.vsix`;

export default async function handlePreReleaseChannels(
  context: ExtensionContext
): Promise<void> {
  try {
    void showNotificationForBetaChannelIfNeeded(context);
    let downloadedVersion;

    if (userConsumesProposedAlphaUpdates()) {
      const currentVersion = getCurrentVersion(context);
      if (currentVersion !== PROPOSED_ALPHA_VERSION) {
        const { name } = await createTempFileWithPostfix(".vsix");
        await downloadFileToDestination(PROPOSED_ALPHA_ARTIFACTS_URL, name);
        await commands.executeCommand(INSTALL_COMMAND, Uri.file(name));
        await updatePersistedAlphaVersion(context, PROPOSED_ALPHA_VERSION);

        downloadedVersion = PROPOSED_ALPHA_VERSION;
      }
    } else if (userConsumesPreReleaseChannelUpdates()) {
      const artifactUrl = await getArtifactUrl();
      const availableVersion = getAvailableAlphaVersion(artifactUrl);

      if (isNewerAlphaVersionAvailable(context, availableVersion)) {
        const { name } = await createTempFileWithPostfix(".vsix");
        await downloadFileToDestination(artifactUrl, name);
        await commands.executeCommand(INSTALL_COMMAND, Uri.file(name));
        await updatePersistedAlphaVersion(context, availableVersion);

        downloadedVersion = availableVersion;
      }
    }

    if (downloadedVersion) {
      void showMessage({
        messageId: "prerelease-installer-update",
        messageText: `TabNine has been updated to ${downloadedVersion} version. Please reload the window for the changes to take effect.`,
        buttonText: "Reload",
        action: () =>
          void commands.executeCommand("workbench.action.reloadWindow"),
      });
    }
  } catch (e) {
    console.error(e);
  }
}

async function getArtifactUrl(): Promise<string> {
  const response = JSON.parse(
    await downloadFileToStr(LATEST_RELEASE_URL)
  ) as GitHubReleaseResponse;
  return response[0].assets[0].browser_download_url;
}

function isNewerAlphaVersionAvailable(
  context: ExtensionContext,
  availableVersion: string
): boolean {
  const currentVersion = getCurrentVersion(context);
  const isNewerVersion =
    !!currentVersion && semver.gt(availableVersion, currentVersion);
  const isAlphaAvailable = !!semver
    .prerelease(availableVersion)
    ?.includes("alpha");
  const isSameWithAlphaAvailable =
    !!currentVersion &&
    semver.eq(semver.coerce(availableVersion)?.version || "", currentVersion) &&
    isAlphaAvailable;

  return (isAlphaAvailable && isNewerVersion) || isSameWithAlphaAvailable;
}

async function showNotificationForBetaChannelIfNeeded(
  context: ExtensionContext
) {
  const didShowMessage = context.globalState.get<boolean>(
    BETA_CHANNEL_MESSAGE_SHOWN_KEY
  );

  const shouldShowMessage =
    isPreReleaseChannelSupported() &&
    (tabnineExtensionProperties.isVscodeInsiders ||
      isCapabilityEnabled(Capability.ALPHA_CAPABILITY)) &&
    !didShowMessage &&
    !tabnineExtensionProperties.isExtentionBetaChannelEnabled;

  if (!shouldShowMessage) {
    return;
  }

  await showMessage({
    messageId: "vscode-join-beta-channel",
    messageText:
      "Do you wish to help Tabnine get better? Enable Tabnine's extension beta channel if so!",
    buttonText: "Open Settings",
    action: () =>
      void commands.executeCommand(
        "workbench.action.openSettings",
        "tabnine.receiveBetaChannelUpdates"
      ),
  });

  await context.globalState.update(BETA_CHANNEL_MESSAGE_SHOWN_KEY, true);
}
