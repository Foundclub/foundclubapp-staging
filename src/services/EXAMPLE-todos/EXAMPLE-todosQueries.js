import { useQuery } from '@tanstack/react-query';
import { getTodos } from './EXAMPLE-todosService';

/**
 * Hook to get todos with pagination
 * @param {object} params
 * @param {number} [params.limit] - Number of todos to return
 * @param {number} [params.skip] - Number of todos to skip
 * @returns {import('@tanstack/react-query').UseQueryResult<{
 * todos: Array<Todo>, total: number, skip: number, limit: number}, Error>}
 */
export const useGetTodos = ({ limit = 10, skip = 0 } = {}) => useQuery({
  queryKey: ['todos', { limit, skip }],
  queryFn: () => getTodos({ limit, skip }),
});
