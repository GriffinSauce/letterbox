import { getSession } from 'next-auth/client';
import { google, gmail_v1 } from 'googleapis';
import { NextApiRequest, NextApiResponse } from 'next';
import Debug from 'debug';

const debug = Debug('api:email:messages:id');

export interface ResponseData {
  message: gmail_v1.Schema$Message;
}

const handleGet = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
): Promise<void> => {
  const session = await getSession({ req });
  if (!session) {
    // @ts-expect-error - TODO: find typing that works with swr
    res.status(403).json({ error: 'Not authenticated' });
    return;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_ID,
    process.env.GOOGLE_SECRET,
  );
  oauth2Client.setCredentials({
    access_token: session.accessToken,
  });

  const gmail = google.gmail({
    version: 'v1',
    auth: oauth2Client,
  });

  const { id } = req.query;

  let message: gmail_v1.Schema$Message;
  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: `${id}`,
      format: 'FULL',
    });
    message = response.data;
  } catch (err) {
    throw new Error(`Error fetching message ${id} - ${err.message}`);
  }
  debug('Fetched message');

  res.json({ message });
};

const handlePost = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
): Promise<void> => {
  const session = await getSession({ req });
  if (!session) {
    // @ts-expect-error - TODO: find typing that works with swr
    res.status(403).json({ error: 'Not authenticated' });
    return;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_ID,
    process.env.GOOGLE_SECRET,
  );
  oauth2Client.setCredentials({
    access_token: session.accessToken,
  });

  const gmail = google.gmail({
    version: 'v1',
    auth: oauth2Client,
  });

  const { id } = req.query;

  try {
    await gmail.users.messages.modify({
      userId: 'me',
      id: `${id}`,
      requestBody: req.body,
    });
  } catch (err) {
    throw new Error(`Error fetching message ${id} - ${err.message}`);
  }
  debug('Fetched message');

  res.status(204).send({ ok: true });
};

export default async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>,
): Promise<void> => {
  switch (req.method) {
    case 'GET':
      await handleGet(req, res);
      break;
    case 'POST':
      await handlePost(req, res);
      break;
    default:
      res.status(405).end(); //Method Not Allowed
      break;
  }
};
