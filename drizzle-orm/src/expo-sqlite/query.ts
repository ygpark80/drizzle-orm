import { addDatabaseChangeListener } from 'expo-sqlite/next';
import { useEffect, useState } from 'react';
import { SQL, Subquery, is } from '~/index.ts';
import type { AnySQLiteSelect } from '~/sqlite-core/index.ts';
import { SQLiteTable, SQLiteView, getTableConfig, getViewConfig } from '~/sqlite-core/index.ts';
import { SQLiteRelationalQuery } from '~/sqlite-core/query-builders/query';

export const useLiveQuery = <
  T extends Pick<AnySQLiteSelect, '_' | 'then' | 'config'> | SQLiteRelationalQuery<'sync', unknown>,
>(
  query: T,
) => {
  const [data, setData] = useState<Awaited<T>>(
    (is(query, SQLiteRelationalQuery) && query.mode === 'first' ? undefined : []) as Awaited<T>,
  );
  const [error, setError] = useState<Error>();
  const [updatedAt, setUpdatedAt] = useState<Date>();

  useEffect(() => {
    const entity = is(query, SQLiteRelationalQuery) ? query.table : query.config.table;

    if (is(entity, Subquery) || is(entity, SQL)) {
      setError(new Error('Selecting from subqueries and SQL are not supported in useLiveQuery'));
      return;
    }

    let listener: ReturnType<typeof addDatabaseChangeListener> | undefined;

    const handleData = (data: any) => {
      setData(data);
      setUpdatedAt(new Date());
    };

    query.then(handleData).catch(setError);

    if (is(entity, SQLiteTable) || is(entity, SQLiteView)) {
      const config = is(entity, SQLiteTable) ? getTableConfig(entity) : getViewConfig(entity);
      listener = addDatabaseChangeListener(({ tableName }) => {
        if (config.name === tableName) {
          query.then(handleData).catch(setError);
        }
      });
    }

    return () => {
      listener?.remove();
    };
  }, []);

  return {
    data,
    error,
    updatedAt,
  } as const;
};
