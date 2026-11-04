import EmailEvent from './emailEvent.model.js';

export async function findByIdempotencyKey(idempotencyKey) {
  return EmailEvent.findOne({ direction: 'outbound', idempotencyKey }).select(
    '+idempotencyKey +payloadHash',
  );
}

export async function createQueuedEvent(eventData) {
  try {
    return await EmailEvent.create(eventData);
  } catch (error) {
    if (error.code !== 11000 || !eventData.idempotencyKey) {
      throw error;
    }

    return findByIdempotencyKey(eventData.idempotencyKey);
  }
}

export async function markEventSent(eventId) {
  const event = await EmailEvent.findOneAndUpdate(
    { _id: eventId, direction: 'outbound', status: 'queued' },
    { $set: { status: 'sent', error: undefined, processedAt: new Date() } },
    { returnDocument: 'after' },
  );

  if (!event) {
    const existing = await EmailEvent.findById(eventId);
    if (!existing || existing.status !== 'sent') {
      throw new Error('Queued email event could not be marked sent');
    }
  }
}

export async function markEventFailed(eventId, errorCode) {
  const result = await EmailEvent.updateOne(
    {
      _id: eventId,
      direction: 'outbound',
      status: 'queued',
    },
    {
      $set: {
        status: 'failed',
        error: errorCode,
        processedAt: new Date(),
      },
    },
  );

  return result.modifiedCount === 1;
}
