import {getModelForClass, modelOptions, prop} from '@typegoose/typegoose';

@modelOptions({options: {allowMixed: 0}})
export class EmojiUrl {
  /**
   * The emoji url id.
   */
  @prop()
  _id: string;

  /**
   * The original file name.
   */
  @prop()
  filename: string;

  /**
   * The uuid of the user who uploaded the file.
   */
  @prop()
  uploader: string;
}

export default getModelForClass(EmojiUrl);
