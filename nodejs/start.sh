#! /bin/sh
cd /app

# rm -rf .installed

if [ ! -f .installed ]; then
    echo "Installing dependencies..."
    rm -rf node_modules
    rm -rf .pnpm-store
    rm -rf .pnpm
    rm -rf .cache
    rm -rf pnpm-lock.yaml
    rm -rf yarn.lock
    rm -rf package-lock.json
    yarn install --shamefully-hoist
    node initialize.mjs
    touch .installed
fi

yarn run start
