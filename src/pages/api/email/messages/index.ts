import { getSession } from 'next-auth/client';
import { gmail_v1 } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';
import Debug from 'debug';
import {
  getNewsletterLabel,
  getBaseMessages,
  getMessage,
  isAuthenticationError,
} from 'utils/gmail';
import { MessageFormat } from 'types/gmail';
import makeCache from 'utils/makeCache';

const debug = Debug('subsmarine:api:email:messages');

enum ErrorMessage {
  Unauthenticated = 'unauthenticated',
  UnhandledError = 'unhandledError',
  LabelNotFound = 'labelNotFound',
}

export interface ResponseData {
  messages: gmail_v1.Schema$Message[];
}

export interface ResponseError {
  error: ErrorMessage;
}

type ResponseDataOrError = ResponseData | ResponseError;

interface GetNewsletterLabelParams {
  userId: string;
  accessToken: string;
}

const getNewsletterLabelCached = makeCache<
  GetNewsletterLabelParams,
  ReturnType<typeof getNewsletterLabel>
>({
  generateKey: ({ userId }) => `user:${userId}:labels:newsletter`,
  fetchFreshValue: ({ accessToken }) => getNewsletterLabel({ accessToken }),
  ttl: 60 * 60 * 24 * 7, // One week in seconds,
});

export default async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseDataOrError>,
): Promise<void> => {
  const session = await getSession({ req });
  if (!session) {
    res.status(401).json({ error: ErrorMessage.Unauthenticated });
    return;
  }

  debug('fetching messages');

  const { accessToken, user } = session;

  // @ts-expect-error - user.id is missing on type
  const userId = user.id;

  let newsletterLabel: gmail_v1.Schema$Label;
  try {
    newsletterLabel = await getNewsletterLabelCached({
      userId,
      accessToken,
    });
  } catch (error) {
    if (isAuthenticationError(error)) {
      res.status(401).json({ error: ErrorMessage.Unauthenticated });
      return;
    }
    res.status(500).json({ error: ErrorMessage.UnhandledError });
    return;
  }
  if (!newsletterLabel) {
    res.status(404).json({ error: ErrorMessage.LabelNotFound });
    return;
  }

  debug('fetched label', newsletterLabel);

  let messages: gmail_v1.Schema$Message[];
  try {
    messages = await getBaseMessages({
      accessToken,
      labelId: newsletterLabel.id,
      maxResults: 50,
    });
  } catch (error) {
    if (isAuthenticationError(error)) {
      res.status(401).json({ error: ErrorMessage.Unauthenticated });
      return;
    }
    res.status(500).json({ error: ErrorMessage.UnhandledError });
    return;
  }
  debug('fetched message list');

  // Add labels and headers to messages
  const messagesWithMeta: gmail_v1.Schema$Message[] = await Promise.all(
    messages.map((message) =>
      getMessage({
        accessToken,
        messageId: message.id,
        format: MessageFormat.Metadata,
      }),
    ),
  );

  res.json({ messages: messagesWithMeta });
};
