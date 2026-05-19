#!/bin/sh

echo "Initiating Migration..."
# NODE_PATH may be a colon-separated search path. MIGRATE_DEPS_DIR points to
# a single node_modules root that hosts the typeorm CLI we shell out to.
export NODE_PATH=${NODE_PATH:-$(npm root -g)}
MIGRATE_DEPS_DIR=${MIGRATE_DEPS_DIR:-$(npm root -g)}

cd ./npm
if [ "$DB_ENGINE" = "mongo" ]
then
    migrate-mongo up
else
    if [ "$1" = "revert" ]
    then
        ts-node --transpile-only --project tsconfig.json "$MIGRATE_DEPS_DIR/typeorm/cli.js" migration:revert -d ./typeorm.ts
    else
        ts-node --transpile-only --project tsconfig.json "$MIGRATE_DEPS_DIR/typeorm/cli.js" migration:run -d ./typeorm.ts
    fi
fi
if [ $? -eq 1 ]
then
    echo "Migration Failed..."
    exit 1
fi
echo "Migration Finished..."

cd ..

