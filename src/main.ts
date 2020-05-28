import * as turbo from 'turbo-http';
import * as dotenv from 'dotenv';
import handler from '../api';

dotenv.config();

const server = turbo.createServer(handler);

server.listen(3111);
