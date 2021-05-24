import {getModelForClass, modelOptions, prop} from '@typegoose/typegoose';

@modelOptions({options: {allowMixed: 0}})
export class Counter {
  /**
   * The counter identifier.
   */
  @prop()
  _id: string;

  /**
   * The current count.
   */
  @prop()
  count: number;

  /**
   * the current motd
   */

  @prop()
  motd: string;
}

export default getModelForClass(Counter);
