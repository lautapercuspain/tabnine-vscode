// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha";
import * as vscode from "vscode";
import { reset, verify } from "ts-mockito";
import {
  isProcessReadyForTest,
  readLineMock,
  requestResponseItems,
  stdinMock,
  stdoutMock,
} from "../../binary/mockedRunProcess";
import {
  acceptInline,
  completion,
  makeAChange,
  mockAutocomplete,
  moveToActivePosition,
  triggerInline,
} from "./utils/completion.utils";
import { activate, getDocUri, openDocument } from "./utils/helper";
import {
  aCompletionResult,
  anAutocompleteResponse,
  INLINE_NEW_PREFIX,
  INLINE_PREFIX,
  SINGLE_CHANGE_CHARACTER,
} from "./utils/testData";
import { AutocompleteRequestMatcher } from "./utils/AutocompleteRequestMatcher";
import { resetBinaryForTesting } from "../../binary/requests/requests";
import { sleep } from "../../utils/utils";

describe("Should do completion", () => {
  const docUri = getDocUri("completion.txt");

  beforeEach(async () => {
    await activate(docUri);
  });

  afterEach(() => {
    reset(stdinMock);
    reset(stdoutMock);
    reset(readLineMock);
    requestResponseItems.length = 0;
    resetBinaryForTesting();
  });

  test("Passes the correct request to binary process on completion", async () => {
    await completion(docUri, new vscode.Position(0, 6));

    verify(stdinMock.write(new AutocompleteRequestMatcher(), "utf8")).once();
  });

  it("Returns the completions in a correct way", async () => {
    mockAutocomplete(requestResponseItems, anAutocompleteResponse());

    const completions = await completion(docUri, new vscode.Position(0, 6));

    expect(completions?.items).to.shallowDeepEqual(aCompletionResult());
  });
  it("should return a inline completion", async () => {
    await isProcessReadyForTest();
    mockAutocomplete(
      requestResponseItems,
      anAutocompleteResponse(INLINE_PREFIX, INLINE_NEW_PREFIX)
    );
    await moveToActivePosition();
    await makeAChange(SINGLE_CHANGE_CHARACTER);
    await triggerInline();

    await sleep(1000);

    await acceptInline();

    expect(vscode.window.activeTextEditor?.document.getText()).to.equal(
      INLINE_NEW_PREFIX
    );
  });
  it("should prefer an inline when both popup and inline are visible", async () => {
    await assertSuggestionWith("console.log", () => {
      mockAutocomplete(
        requestResponseItems,
        anAutocompleteResponse("console", "console.log")
      );
    });
  });
  it("should prefer the popup when only popup is visible and there is no inline suggestion", async () => {
    await assertSuggestionWith("console");
  });
});
async function assertSuggestionWith(expected: string, inlineMock?: () => void) {
  await openDocument("javascript", "cons");
  await isProcessReadyForTest();
  await moveToActivePosition();
  await makeAChange("o");
  await sleep(200);
  await vscode.commands.executeCommand("editor.action.triggerSuggest");
  inlineMock?.();
  await sleep(500);
  await triggerInline();

  await sleep(400);

  await vscode.commands.executeCommand("tabnine.tab-override");
  await sleep(100);
  expect(vscode.window.activeTextEditor?.document.getText()).to.equal(expected);
}
