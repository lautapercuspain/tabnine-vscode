import * as assert from "assert";
import { beforeEach, it, afterEach, describe } from "mocha";
import * as sinon from "sinon";
import { reset } from "ts-mockito";
import { Range } from "vscode";
import {
  activate,
  clearUnsavedChanges,
  getDocUri,
  sleep,
} from "./utils/helper";
import {
  isProcessReadyForTest,
  readLineMock,
  requestResponseItems,
  stdinMock,
  stdoutMock,
} from "../../binary/mockedRunProcess";
import { resetBinaryForTesting } from "../../binary/requests/requests";
import {
  makeAChange,
  mockAutocomplete,
  moveToActivePosition,
  triggerInline,
} from "./utils/completion.utils";
import {
  anAutocompleteResponse,
  INLINE_NEW_PREFIX,
  INLINE_PREFIX,
  SINGLE_CHANGE_CHARACTER,
} from "./utils/testData";
import * as vscodeApi from "../../vscode.api";

describe("Should show attribution item on inline suggestion", () => {
  const docUri = getDocUri("completion.txt");

  beforeEach(async () => {
    await activate(docUri);
  });

  afterEach(async () => {
    reset(stdinMock);
    reset(stdoutMock);
    reset(readLineMock);
    requestResponseItems.length = 0;
    await resetBinaryForTesting();
    await clearUnsavedChanges();
    sinon.verifyAndRestore();
  });
  it("should display attribution item on inline suggestion", async () => {
    const setDecorations = sinon.spy(vscodeApi, "setDecoration");
    await isProcessReadyForTest();
    mockAutocomplete(
      requestResponseItems,
      anAutocompleteResponse(INLINE_PREFIX, INLINE_NEW_PREFIX)
    );
    await sleep(1000);
    await moveToActivePosition();
    await makeAChange(SINGLE_CHANGE_CHARACTER);
    await triggerInline();

    await sleep(1000);
    assert(
      setDecorations.calledWith(sinon.match.any, [new Range(0, 0, 0, 0)]),
      "attribution should show"
    );
  });
  it("should remove the attribution element after any change in the document", async () => {
    const setDecorations = sinon.spy(vscodeApi, "setDecoration");
    await isProcessReadyForTest();
    mockAutocomplete(
      requestResponseItems,
      anAutocompleteResponse(INLINE_PREFIX, INLINE_NEW_PREFIX)
    );
    await sleep(1000);
    await moveToActivePosition();
    await makeAChange(SINGLE_CHANGE_CHARACTER);
    await triggerInline();

    await sleep(1000);
    assert(
      setDecorations.calledWith(sinon.match.any, [new Range(0, 0, 0, 0)]),
      "attribution should show"
    );
    await makeAChange(SINGLE_CHANGE_CHARACTER);
    await sleep(1000);
    assert(
      setDecorations.lastCall.calledWith(sinon.match.any, []),
      "attribution should be removed"
    );
  });
});