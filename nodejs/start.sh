#! /bin/sh
cd /app

if [ ! -f .installed ]; then
    node initialize.mjs
    touch .installed
fi
yarn install
npm run start
