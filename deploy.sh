#!/bin/sh

set -e

git pull
pnpm build
pm2 restart tpass-form
pm2 reset tpass-form
