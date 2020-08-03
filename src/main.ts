import * as dotenv from 'dotenv';
import * as turbo from 'turbo-http';
import handler from '../api';

dotenv.config();

const server = turbo.createServer(handler);

server.listen(3111);
