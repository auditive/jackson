import {
  DatabaseDriver,
  DatabaseDriverOption,
  DatabaseOption,
  Encrypted,
  EncryptionKey,
  Index,
  Records,
  RequiredLogger,
  SortOrder,
  Storable,
} from '../typings';
import * as encrypter from './encrypter';
import mem from './mem';
import mongo from './mongo';
import redis from './redis';
import sql from './sql/sql';
import store from './store';
import dynamodb from './dynamoDb';

import { JacksonStore } from './sql/entity/JacksonStore';
import { JacksonIndex } from './sql/entity/JacksonIndex';
import { JacksonTTL } from './sql/entity/JacksonTTL';

import { JacksonStore as JacksonStorePlanetscale } from './planetscale/entity/JacksonStore';
import { JacksonIndex as JacksonIndexPlanetscale } from './planetscale/entity/JacksonIndex';
import { JacksonTTL as JacksonTTLPlanetscale } from './planetscale/entity/JacksonTTL';

import { JacksonStore as JacksonStoreMSSQL } from './sql/mssql/entity/JacksonStore';
import { JacksonIndex as JacksonIndexMSSQL } from './sql/mssql/entity/JacksonIndex';
import { JacksonTTL as JacksonTTLMSSQL } from './sql/mssql/entity/JacksonTTL';

import { JacksonStore as JacksonStoreSQLITE } from './sql/sqlite/entity/JacksonStore';
import { JacksonIndex as JacksonIndexSQLITE } from './sql/sqlite/entity/JacksonIndex';
import { JacksonTTL as JacksonTTLSQLITE } from './sql/sqlite/entity/JacksonTTL';

import { JacksonStore as JacksonStoreMariaDB } from './sql/mariadb/entity/JacksonStore';
import { JacksonIndex as JacksonIndexMariaDB } from './sql/mariadb/entity/JacksonIndex';
import { JacksonTTL as JacksonTTLMariaDB } from './sql/mariadb/entity/JacksonTTL';

const decrypt = (res: Encrypted, encryptionKey: EncryptionKey): unknown => {
  if (res.iv && res.tag) {
    return JSON.parse(encrypter.decrypt(res.value, res.iv, res.tag, encryptionKey));
  }

  return JSON.parse(res.value);
};

class DB implements DatabaseDriver {
  private db: DatabaseDriver;
  private encryptionKey: EncryptionKey;
  constructor(db: DatabaseDriver, encryptionKey: EncryptionKey) {
    this.db = db;
    this.encryptionKey = encryptionKey;
  }

  async get(namespace: string, key: string): Promise<unknown> {
    const res = await this.db.get(namespace, key);

    if (!res) {
      return null;
    }

    return decrypt(res, this.encryptionKey);
  }

  async getAll(
    namespace: string,
    pageOffset?: number,
    pageLimit?: number,
    pageToken?: string,
    sortOrder?: SortOrder
  ): Promise<Records> {
    const res = await this.db.getAll(namespace, pageOffset, pageLimit, pageToken, sortOrder);
    const encryptionKey = this.encryptionKey;
    return {
      data: res.data.map((r) => {
        return decrypt(r, encryptionKey);
      }),
      pageToken: res.pageToken,
    };
  }

  async getByIndex(
    namespace: string,
    idx: Index,
    pageOffset?: number,
    pageLimit?: number,
    pageToken?: string,
    sortOrder?: SortOrder
  ): Promise<Records> {
    const res = await this.db.getByIndex(namespace, idx, pageOffset, pageLimit, pageToken, sortOrder);
    const encryptionKey = this.encryptionKey;
    return {
      data: res.data.map((r) => {
        return decrypt(r, encryptionKey);
      }),
      pageToken: res.pageToken,
    };
  }

  async getCount(namespace: string, idx?: Index): Promise<number | undefined> {
    if (typeof this.db.getCount !== 'function') {
      return;
    }
    return await this.db.getCount(namespace, idx);
  }

  // ttl is in seconds
  async put(namespace: string, key: string, val: unknown, ttl = 0, ...indexes: Index[]): Promise<unknown> {
    const dbVal = this.encryptionKey
      ? encrypter.encrypt(JSON.stringify(val), this.encryptionKey)
      : { value: JSON.stringify(val) };

    return await this.db.put(namespace, key, dbVal, ttl, ...indexes);
  }

  async delete(namespace: string, key: string): Promise<unknown> {
    return await this.db.delete(namespace, key);
  }

  async deleteMany(namespace: string, keys: string[]): Promise<void> {
    return await this.db.deleteMany(namespace, keys);
  }

  async close(): Promise<void> {
    await this.db.close();
  }

  store(namespace: string, ttl = 0): Storable {
    return store.new(namespace, this, ttl);
  }
}

const _new = async (options: { db: DatabaseOption | DatabaseDriverOption; logger: RequiredLogger }) => {
  const dbOpts = options.db;
  const encryptionKey = dbOpts.encryptionKey
    ? dbOpts.encryptionKey.length === 32
      ? Buffer.from(dbOpts.encryptionKey, 'latin1')
      : Buffer.from(dbOpts.encryptionKey, 'base64')
    : null;

  if ('driver' in dbOpts) {
    return new DB(dbOpts.driver, encryptionKey);
  }

  switch (dbOpts.engine) {
    case 'redis':
      return new DB(await redis.new(options), encryptionKey);
    case 'sql':
      switch (dbOpts.type) {
        case 'mssql':
          return new DB(
            await sql.new(options, {
              JacksonStore: JacksonStoreMSSQL,
              JacksonIndex: JacksonIndexMSSQL,
              JacksonTTL: JacksonTTLMSSQL,
            }),
            encryptionKey
          );
        case 'mariadb':
        case 'mysql':
          return new DB(
            await sql.new(options, {
              JacksonStore: JacksonStoreMariaDB,
              JacksonIndex: JacksonIndexMariaDB,
              JacksonTTL: JacksonTTLMariaDB,
            }),
            encryptionKey
          );
        case 'sqlite':
          return new DB(
            await sql.new(options, {
              JacksonStore: JacksonStoreSQLITE,
              JacksonIndex: JacksonIndexSQLITE,
              JacksonTTL: JacksonTTLSQLITE,
            }),
            encryptionKey
          );
        default:
          return new DB(
            await sql.new(options, {
              JacksonStore,
              JacksonIndex,
              JacksonTTL,
            }),
            encryptionKey
          );
      }
    case 'planetscale':
      return new DB(
        await sql.new(options, {
          JacksonStore: JacksonStorePlanetscale,
          JacksonIndex: JacksonIndexPlanetscale,
          JacksonTTL: JacksonTTLPlanetscale,
        }),
        encryptionKey
      );
    case 'mongo':
      return new DB(await mongo.new(options), encryptionKey);
    case 'mem':
      return new DB(await mem.new(options), encryptionKey);
    case 'dynamodb':
      return new DB(await dynamodb.new(options), encryptionKey);
    default:
      throw new Error('unsupported db engine: ' + dbOpts.engine);
  }
};

const g = global as any;

export default {
  new: async (
    options: { db: DatabaseOption | DatabaseDriverOption; logger: RequiredLogger },
    noCache = false
  ) => {
    if (g.__jacksonDb && !noCache) {
      return g.__jacksonDb;
    }

    g.__jacksonDb = new Promise((resolve, reject) => {
      _new(options).then(resolve).catch(reject);
    });

    return await g.__jacksonDb;
  },
};
