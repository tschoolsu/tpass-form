#!/bin/sh

set -e

git pull
pnpm build
pm2 restart form
pm2 reset form
