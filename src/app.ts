import * as dotenv from 'dotenv'
dotenv.config()

import * as express from 'express';
import { Request, Response } from 'express';
import * as cors from 'cors';
import * as amqp from 'amqplib/callback_api';

import { myDataSource } from "./app-data-source";
import { Product } from './entity/product';

const app = express();

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:4200']
}));

app.use(express.json());

myDataSource
    .initialize()
    .then(() => {
        console.log("Data Source has been initialized!");

        amqp.connect(process.env.AMQP_URL, (error0, connection) => {
            if (error0) {
                throw error0;
            }

            connection.createChannel((error1, channel) => {
                if (error1) {
                    throw error0;
                }

                const productRepository = myDataSource.getRepository(Product);

                app.get('/api/products', async (req: Request, res: Response) => {
                    try {
                        const products = await productRepository.find();
                        return res.send(products)
                    } catch (err) {
                        console.log(err)
                    }
                });

                app.get('/api/products/:id', async (req: Request, res: Response) => {
                    try {
                        const product = await productRepository.findOneBy({
                            id: parseInt(req.params.id),
                        });

                        return res.send(product)
                    } catch (err) {
                        console.log(err)
                    }
                });

                app.post('/api/products', async (req: Request, res: Response) => {
                    try {
                        const product = await productRepository.create(req.body);
                        const result = await productRepository.save(product);
                        channel.sendToQueue('product_created', Buffer.from(JSON.stringify(result)));
                        return res.send(result)
                    } catch (err) {
                        console.log(err)
                    }
                });

                app.put("/api/products/:id", async function (req: Request, res: Response) {

                    try {
                        const product = await productRepository.findOneBy({ id: parseInt(req.params.id) });
                        productRepository.merge(product, req.body);
                        const result = await productRepository.save(product);
                        channel.sendToQueue('product_updated', Buffer.from(JSON.stringify(result)));
                        return res.send(result);
                    } catch (err) {
                        console.log(err)
                    }
                });

                app.delete("/api/products/:id", async function (req: Request, res: Response) {
                    try {
                        const results = await productRepository.delete(req.params.id)
                        channel.sendToQueue('product_deleted', Buffer.from(req.params.id));
                        return res.send(results)
                    } catch (err) {
                        console.log(err)
                    }
                });

                app.listen(process.env.PORT, () => {
                    console.log(`Admin listenting on port ${process.env.PORT}`)
                });

                process.on('beforeExit', () => {
                    console.log('closing Admin Rabbit connection...');
                    connection.close();
                });

            });
        });


    })
    .catch((err) => {
        console.error("Error during Data Source initialization:", err)
    });





