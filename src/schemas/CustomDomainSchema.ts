import {boolean, object, string} from 'joi';

export default object({
  name: string().required().domain(),

  wildcard: boolean().required(),

  userOnly: boolean().required(),
}).options({abortEarly: false});
