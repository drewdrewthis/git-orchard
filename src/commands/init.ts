import { getInitInstructions } from "../lib/shell.js";

export function handleInit(): void {
  console.log(getInitInstructions());
  process.exit(0);
}
