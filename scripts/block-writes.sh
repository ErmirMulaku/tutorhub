#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
[ -z "$COMMAND" ] && exit 0
if echo "$COMMAND" | grep -qE '\brm\b|>|sed -i|git checkout|git reset'; then
  echo "Blocked: this agent is read-only" >&2
  exit 2
fi
exit 0