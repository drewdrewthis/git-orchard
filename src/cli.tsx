#!/usr/bin/env node
import { render } from "ink";
import meow from "meow";
import App from "./app.js";
import { handleInit } from "./commands/init.js";
import { handleUpgrade } from "./commands/upgrade.js";
import { log } from "./lib/log.js";

const cli = meow(
  `
  Usage
    $ git-orchard              Interactive worktree manager
    $ git-orchard init         Print shell function for tmux session integration
    $ git-orchard upgrade      Upgrade to the latest version
    $ git-orchard cleanup      Find worktrees with merged PRs to remove

  Options
    --json    Output worktree data as JSON and exit

  Navigation
    1-9     Jump to worktree by number
    ↑/↓     Select worktree
    t       tmux into worktree (attach or create session)
    d       Delete selected worktree
    c       Cleanup merged worktrees
    r       Refresh list
    q       Quit
`,
  {
    importMeta: import.meta,
    flags: {
      json: {
        type: "boolean",
        default: false,
      },
    },
  }
);

const command = cli.input[0];
log.info(`startup: git-orchard${command ? ` command=${command}` : ""}`);

if (command === "init") {
  handleInit();
} else if (command === "upgrade") {
  await handleUpgrade();
} else if (cli.flags.json) {
  const { collectWorktreeData } = await import("./lib/collect.js");
  const data = await collectWorktreeData();
  console.log(JSON.stringify(data, null, 2));
} else {
  const app = render(<App command={command} />);
  await app.waitUntilExit();
}
