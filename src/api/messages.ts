import { useQuery, UseQueryOptions } from 'react-query';
import fetcher from 'utils/fetcher';
import { ResponseData } from 'pages/api/email/messages';

export const fetchMessages = (): Promise<ResponseData> =>
  fetcher('/api/email/messages');

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function useMessages(options?: UseQueryOptions<ResponseData>) {
  return useQuery<ResponseData>('messages', fetchMessages, options);
}