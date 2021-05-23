import {object, string} from 'joi';

export default object({
  url: string().allow('').max(100),
}).options({abortEarly: false});
