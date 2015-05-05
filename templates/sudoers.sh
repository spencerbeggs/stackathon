#!/bin/sh
if [ -z "$1" ]; then
  export EDITOR=$0 && sudo -E visudo
else
  echo "%wheel ALL=(ALL) ALL" >> $1
fi
