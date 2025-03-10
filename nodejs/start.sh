#! /bin/sh
cd /app

if [ ! -f .installed ]; then
    pnpm install
    node initialize.mjs
    touch .installed
fi
yarn install
#npm run start
node --inspect=0.0.0.0:9229 main.mjs
