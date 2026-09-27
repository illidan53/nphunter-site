import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TableName = process.env.TABLE_NAME;
export const store = {
  async get(pk, sk = 'META') { return (await db.send(new GetCommand({ TableName, Key: { pk, sk }, ConsistentRead: true }))).Item; },
  async put(item, unique = false) {
    try { await db.send(new PutCommand({ TableName, Item: item, ...(unique ? { ConditionExpression: 'attribute_not_exists(pk)' } : {}) })); return true; }
    catch (error) { if (error.name === 'ConditionalCheckFailedException') return false; throw error; }
  },
  async take(pk) { return (await db.send(new DeleteCommand({ TableName, Key: { pk, sk: 'META' }, ReturnValues: 'ALL_OLD' }))).Attributes; },
  async page(day, cursor, limit = 100) {
    const result = await db.send(new QueryCommand({ TableName, KeyConditionExpression: 'pk = :day', ExpressionAttributeValues: { ':day': `DAY#${day}` }, ScanIndexForward: false, Limit: limit, ...(cursor ? { ExclusiveStartKey: { pk: `DAY#${day}`, sk: cursor } } : {}) }));
    return { items: result.Items || [], cursor: result.LastEvaluatedKey?.sk || null };
  }
};
