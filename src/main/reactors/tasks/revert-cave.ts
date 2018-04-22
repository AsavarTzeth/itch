import { Watcher } from "common/util/watcher";
import { actions } from "common/actions";

import rootLogger from "common/logger";
const logger = rootLogger.child({ name: "revert-cave" });

import { promisedModal } from "../modals";

import asTask from "./as-task";
import { modalWidgets } from "renderer/components/modal-widgets/index";

import { withLogger, messages } from "common/butlerd";
const call = withLogger(logger);

export default function(watcher: Watcher) {
  watcher.on(actions.revertCaveRequest, async (store, action) => {
    const { caveId } = action.payload;

    const { cave } = await call(messages.FetchCave, { caveId });
    if (!cave || !cave.game) {
      return;
    }

    await asTask({
      store,
      name: "install",
      gameId: cave.game.id,
      work: async (ctx, logger) => {
        await call(messages.InstallVersionSwitchQueue, { caveId }, client => {
          client.on(
            messages.InstallVersionSwitchPick,
            async ({ cave, upload, builds }) => {
              const response = await promisedModal(
                store,
                modalWidgets.revertCave.make({
                  title: ["prompt.revert.title", { title: cave.game.title }],
                  message: "",
                  widgetParams: { cave, upload, builds },
                  buttons: ["cancel"],
                })
              );

              if (!response) {
                // modal was closed
                return { index: -1 };
              }

              return { index: -1 };
            }
          );
        });
      },
    });
  });
}