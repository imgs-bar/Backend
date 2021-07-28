import { randomBytes } from 'crypto';
import emojis from './emojis.json';

/**
 * Generate a string.
 * @param {string} length The length of the string.
 * @return {string} The generated string.
 */
function generateString(length: number): string {
  return randomBytes(length).toString('hex').slice(0, length);
}

/**
 * Generate a invite code.
 * @return {string} The invite code.
 */
function generateInvite(): string {
  const key = randomBytes(80).toString('hex');
  return [key.slice(0, 10), key.slice(1, 12), key.slice(3, 9)].join('-');
}

/**
 * Generate a short url.
 * @return {string} The short url.
 */
function generateInvisibleId(length: number): string {
  let url = '';
  const invisibleCharacters = ['\u200B', '\u2060', '\u200C', '\u200D'].join('');

  for (let i = 0; i < length; i++) {
    url += invisibleCharacters.charAt(
      Math.floor(Math.random() * invisibleCharacters.length)
    );
  }

  return url + '\u200B';
}

function generateRandomEmojis(length: number) {
  let randomEmojis = '';
  for (let i = 0; i < length; i++) {
    randomEmojis =
      randomEmojis + emojis[Math.floor(Math.random() * emojis.length)];
  }
  return randomEmojis;
}

export {generateString, generateInvite, generateInvisibleId, generateRandomEmojis};
