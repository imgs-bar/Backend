import Axios, { Method } from 'axios';
import { AuthorizationInterface } from './interfaces/AuthorizationInterface';
import { DiscordUserInterface } from './interfaces/DiscordUserInterface';
import { stringify } from 'querystring';
import { User } from '../models/UserModel';

/**
 * Send a request to the discord api.
 * @param {string} endpoint The endpoint to send a request to.
 * @param {Method} method The request method.
 * @param {object} body The request body.
 * @param {object} headers The request headers.
 */
export async function request(
  endpoint: string,
  method: Method,
  body?: object | string,
  headers?: object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) {
  try {
    const baseUrl = 'https://discord.com/api';
    const { data } = await Axios({
      url: `${baseUrl}${endpoint}`,
      method,
      headers: headers ? headers : null,
      data: body ? body : null,
    });

    return data;
  } catch (err) {
    throw new Error(
      err.response.data.error_description || err.response.data.message
    );
  }
}

export class OAuth {
  /**
   * The user's access token & refresh token.
   */
  authorization: AuthorizationInterface;

  /**
   * The user's basic information.
   */
  user: DiscordUserInterface;

  /**
   * The OAuth2 grant code.
   */
  code: string;

  constructor(code: string) {
    this.code = code;
  }

  /**
   * Verify that an OAuth grant code is valid.
   * @param {string} requestType The request type, defaults to login.
   */
  validate = async (requestType = 'login'): Promise<void> => {
    this.authorization = await request(
      '/oauth2/token',
      'POST',
      stringify({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        redirect_uri:
          requestType !== 'login'
            ? process.env.DISCORD_LINK_REDIRECT_URI
            : process.env.DISCORD_LOGIN_REDIRECT_URI,
        grant_type: 'authorization_code',
        code: this.code,
      }),
      {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    );
  };

  /**
   * Get a user's basic information.
   * @return {DiscordUserInterface} The user's info.
   */
  getUser = async (): Promise<DiscordUserInterface> => {
    this.user = await request('/users/@me', 'GET', null, {
      Authorization: `Bearer ${this.authorization.access_token}`,
    });

    return this.user;
  };
  /**
   * Add a user to the discord server.
   * @param {User} user The user to add.
   */
  addGuildMember = async (user: User): Promise<void> => {
    const userRole = process.env.USER_ROLE;
    const premiumRole = process.env.PREMIUM_ROLE;

    let data: any = JSON.stringify({
      access_token: this.authorization.access_token,
      nick: user.username,
    });
    try {
      await request(
        `/guilds/${process.env.DISCORD_SERVER_ID}/members/${this.user.id}`,
        'PUT',
        data,
        {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        }
      );

      data = JSON.stringify({
        access_token: this.authorization.access_token,
      });

      await request(
        `/guilds/${process.env.DISCORD_SERVER_ID}/members/${this.user.id}/roles/${userRole}`,
        'PUT',
        data,
        {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        }
      );
    } catch (e) {
      console.log(e.stack);
    }

    if (user.discord.id && user.discord.id !== this.user.id) {
      try {
        data = await request(
          `/guilds/${process.env.DISCORD_SERVER_ID}/members/${user.discord.id}`,
          'GET',
          null,
          {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            'Content-Type': 'application/json',
          }
        );

        const nickData: any = JSON.stringify({
          nick: user.username,
        });

        await request(
          `/guilds/${process.env.DISCORD_SERVER_ID}/members/${this.user.id}`,
          'PATCH',
          nickData,
          {
            Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          }
        );

        if (data.roles.includes(userRole))
          await request(
            `/guilds/${process.env.DISCORD_SERVER_ID}/members/${user.discord.id}/roles/${userRole}`,
            'DELETE',
            null,
            {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            }
          );

        if (user.premium) {
          await request(
            `/guilds/${process.env.DISCORD_SERVER_ID}/members/${this.user.id}/roles/${premiumRole}`,
            'PUT',
            null,
            {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            }
          );
        }
      } catch (err) {
        console.error(err);
      }
    }
  };
}

async function addPremium(user: User) {
  await request(
    `/guilds/${process.env.DISCORD_SERVER_ID}/members/${user.discord.id}/roles/${process.env.PREMIUM_ROLE}`,
    'PUT',
    null,
    {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    }
  );
}

async function removePremium(user: User) {
  await request(
    `/guilds/${process.env.DISCORD_SERVER_ID}/members/${user.discord.id}/roles/${process.env.PREMIUM_ROLE}`,
    'DELETE',
    null,
    {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    }
  );
}

async function addRoles(user: User) {
  const userRole = process.env.USER_ROLE;
  const premiumRole = process.env.PREMIUM_ROLE;

  let data: any = JSON.stringify({
    access_token: this.authorization.access_token,
    nick: user.username,
  });
  try {
    await request(
      `/guilds/${process.env.DISCORD_SERVER_ID}/members/${this.user.id}/roles/${userRole}`,
      'PUT',
      data,
      {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      }
    );
    data = JSON.stringify({
      nick: user.username,
    });
    await request(
      `/guilds/${process.env.DISCORD_SERVER_ID}/members/${this.user.id}`,
      'PATCH',
      data,
      {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      }
    );

    if (user.premium) {
      await request(
        `/guilds/${process.env.DISCORD_SERVER_ID}/members/${user.discord.id}/roles/${premiumRole}`,
        'PUT',
        null,
        {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        }
      );
    }
  } catch (e) {
    console.log(e.stack);
  }
}
export { addPremium, addRoles, removePremium };
