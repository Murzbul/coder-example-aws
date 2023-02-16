import express from 'express';
import AWS from 'aws-sdk';

AWS.config.update({
  region: 'us-east-1'
});

const sns = new AWS.SNS();
const SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:637024062608:notifications';

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = 'product-inventory';

async function readDynamoRecords(scanParams)
{
    try
    {
        let dynamoData = await dynamodb.scan(scanParams).promise();
        const items = dynamoData.Items;

        while (dynamoData.LastEvaluatedKey)
        {
            console.log(dynamoData.LastEvaluatedKey)
           scanParams.ExclusiveStartKey = dynamoData.LastEvaluatedKey;
           dynamoData = await dynamodb.scan(scanParams).promise();
           items.push(...dynamoData.Items);
        }

        return items;
    }
    catch (error)
    {
        throw new Error(error);
    }
}


void (async() =>
{
    try
    {
        const SERVER_PORT = 8080;

        const app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        app.get('/', function(req, res)
        {
            res.send('hello');
        });

        app.get('/api/products', async (req, res) =>
        {
            const params = {
              TableName: TABLE_NAME
            }

            try
            {
              const products = await readDynamoRecords(params);
              res.json(products);
            }
            catch (error)
            {
                console.error('Error', error);
                res.sendStatus(500);
            }
        });

        app.post('/api/products', async (req, res) =>
        {
            const params = {
              TableName: TABLE_NAME,
              Item: req.body
            }

            dynamodb.put(params).promise().then(()=>{
              console.log('saved');
              const prod = JSON.stringify(req.body);
              return sns.publish({
                Message: `new product added! ${prod}`,
                Subject: `new product`,
                TopicArn: SNS_TOPIC_ARN,
              }).promise()
            }).then((data)=>{
                console.log('notified');
                console.log(data);

                const body = {
                  Operation: 'SAVE',
                  Message: 'SUCCESS',
                  Item: req.body
                }
                res.json(body)
              }).catch(error => {
                console.log(error)
                res.sendStatus(500);
            })
        });

        app.listen(SERVER_PORT, () =>
        {
            console.log(`Conectado al puerto: ${SERVER_PORT}`);
        });
    }
    catch (e)
    {
      console.log('Error: ');
      console.log(e);
    }
})();
