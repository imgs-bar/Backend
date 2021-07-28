/* eslint-disable prefer-const */
import {argon2id, hash, verify} from 'argon2';
import {Request, Response, Router} from 'express';
import {sign, verify as verifyjwt} from 'jsonwebtoken';
import {v4 as uuid} from 'uuid';
import {generateString} from '../../utils/GenerateUtil';
import ValidationMiddleware from '../../middlewares/ValidationMiddleware';
import InviteModel from '../../models/InviteModel';
import UserModel from '../../models/UserModel';
import LoginSchema from '../../schemas/LoginSchema';
import RegisterSchema from '../../schemas/RegisterSchema';
import DiscordRouter from './DiscordRouter';
import PasswordResetModel from '../../models/PasswordResetModel';
import CounterModel from '../../models/CounterModel';
import RefreshTokenModel from '../../models/RefreshTokenModel';
// import {checkCaptcha} from '../../utils/CaptchaUtil';
import PasswordResetsRouter from './PasswordResetsRouter';

const router = Router();

async function getNextUid() {
  const {count} = await CounterModel.findByIdAndUpdate('counter', {
    $inc: {
      count: 1,
    },
  });

  return count;
}

router.use('/discord', DiscordRouter);
router.use('/password_resets', PasswordResetsRouter);

router.post('/token', async (req: Request, res: Response) => {
  const cookie = req.cookies['x-refresh-token'];

  if (!cookie)
    return res.status(401).json({
      success: false,
      error: 'provide a refresh token',
    });

  try {
    const refreshToken = await RefreshTokenModel.findOne({token: cookie});

    if (
      !refreshToken ||
      Date.now() >= new Date(refreshToken.expires).getTime()
    ) {
      if (refreshToken) await refreshToken.remove();

      res.status(401).json({
        success: false,
        error: 'invalid refresh token',
      });

      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token: any = verifyjwt(
      refreshToken.token,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await UserModel.findOne({_id: token._id}).select(
      '-__v -password -invite -lastDomainAddition -lastFileArchive -emailVerified  -emailVerificationKey -strikes -bypassAltCheck -ips'
    );

    if (!user)
      return res.status(401).json({
        success: false,
        error: 'invalid refresh token',
      });

    if (!user.settings.embed.siteName) {
      user.settings.embed.siteName = 'https://imgs.bar';
    }
    user.lastLogin = new Date();
    await user.save();

    const accessToken = sign({_id: user._id}, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: '60m',
    });

    res.status(200).json({
      success: true,
      accessToken,
      user,
    });
  } catch (err) {
    res.status(401).json({
      success: false,
      error: 'invalid refresh token',
    });
  }
});

router.post(
  '/register',
  ValidationMiddleware(RegisterSchema),
  async (req: Request, res: Response) => {
    let {
      email,
      username,
      password,
      invite,
      // captcha,
    }: {
      email: string;
      username: string;
      password: string;
      invite: string;
      // captcha: string;
    } = req.body;

    // if (!(await checkCaptcha(captcha))) {
    //   return res.status(401).json({
    //     success: false,
    //     error: 'invalid captcha',
    //   });
    // }

    if (req.user)
      return res.status(400).json({
        success: false,
        error: 'you are already logged in',
      });

    const usernameTaken = await UserModel.findOne({
      username: {$regex: new RegExp(username, 'i')},
    });

    if (usernameTaken)
      return res.status(400).json({
        success: false,
        error: 'the provided username is already taken',
      });

    const emailTaken = await UserModel.findOne({
      email: {$regex: new RegExp(email, 'i')},
    });

    if (emailTaken)
      return res.status(400).json({
        success: false,
        error: 'an account has already been registered with this email',
      });

    const inviteDoc = await InviteModel.findById(invite);

    if (!inviteDoc || !inviteDoc.useable)
      return res.status(400).json({
        success: false,
        error: 'invalid invite code',
      });

    if (inviteDoc.redeemed)
      return res.status(400).json({
        success: false,
        error: 'this invite has already been redeemed',
      });

    let invitedBy = 'Admin';
    const inviter = await UserModel.findOne({_id: inviteDoc.createdBy.uuid});

    if (inviter) {
      invitedBy = inviter.username;

      if (inviter.blacklisted.status) {
        return res.status(400).json({
          success: false,
          error: 'the user you got invited by is banned',
        });
      }
      await UserModel.findByIdAndUpdate(inviter._id, {
        $push: {
          invitedUsers: username,
        },
      });
      await InviteModel.findByIdAndUpdate(invite, {
        usedBy: username,
        redeemed: true,
        useable: false,
      });
    }

    password = await hash(password, {
      type: argon2id,
    });

    try {
      const user = await UserModel.create({
        _id: uuid(),
        uid: await getNextUid(),
        username,
        password,
        invite,
        key: `${username}_${generateString(30)}`,
        premium: false,
        lastDomainAddition: null,
        lastKeyRegen: null,
        lastUsernameChange: null,
        lastFileArchive: null,
        email,
        discord: {
          id: null,
          avatar: null,
        },
        strikes: 0,
        disabled: false,
        blacklisted: {
          status: false,
          reason: null,
        },
        uploads: 0,
        invites: 0,
        invitedBy,
        invitedUsers: [],
        registrationDate: new Date(),
        lastLogin: null,
        admin: false,
        bypassAltCheck: false,
        settings: {
          domain: {
            name: 'i.imgs.bar',
            subdomain: null,
          },
          randomDomain: {
            enabled: false,
            domains: [],
          },
          embed: {
            enabled: true,
            color: '#13ed7c',
            siteName: 'default',
            title: 'default',
            description: 'default',
            author: 'default',
            randomColor: true,
          },
          fakeUrl: {
            enabled: false,
            url: 'https://google.com',
          },
          autoWipe: {
            enabled: false,
            interval: 3600000,
          },
          showLink: false,
          invisibleUrl: false,
          emojiUrl: false,
          longUrl: false,
        },
      });

      await user.save();
      res.status(200).json({
        success: true,
        message: 'registered successfully, please login',
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

router.post(
  '/login',
  ValidationMiddleware(LoginSchema),
  async (req: Request, res: Response) => {
    const {
      username,
      password,
      // captcha,
    }: {
      username: string;
      password: string;
      // captcha: string;
    } = req.body;

    const user = await UserModel.findOne({username});

    // if (!(await checkCaptcha(captcha))) {
    //   return res.status(401).json({
    //     success: false,
    //     error: 'invalid captcha',
    //   });
    // }

    if (
      !user ||
      !(user.password.startsWith('$')
        ? await verify(user.password, password, {
            type: argon2id,
          })
        : false)
    )
      return res.status(401).json({
        success: false,
        error: 'invalid username or password',
      });

    if (user.blacklisted.status)
      return res.status(401).json({
        success: false,
        error: `you are blacklisted for: ${user.blacklisted.reason}`,
      });

    if (user.disabled)
      return res.status(401).json({
        success: false,
        error: "you've disabled your account",
      });

    try {
      const passwordReset = await PasswordResetModel.findOne({user: user._id});
      if (passwordReset) await passwordReset.remove();
      if (!user.settings.fakeUrl) {
        await UserModel.findByIdAndUpdate(user._id, {
          settings: {
            ...user.settings,
            fakeUrl: {
              enabled: false,
              url: 'https://google.com',
            },
          },
        });
      }

      if (!user.settings.embed.siteName) {
        await UserModel.findByIdAndUpdate(user._id, {
          'settings.embed.siteName': 'imgs.bar',
        });
      }

      const accessToken = sign(
        {_id: user._id},
        process.env.ACCESS_TOKEN_SECRET,
        {expiresIn: '15m'}
      );
      const refreshToken = sign(
        {_id: user._id},
        process.env.REFRESH_TOKEN_SECRET
      );

      await RefreshTokenModel.create({
        token: refreshToken,
        user: user._id,
        expires: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
      });

      res.cookie('x-refresh-token', refreshToken, {
        httpOnly: true,
        secure: false,
      });

      res.status(200).json({
        success: true,
        accessToken,
        user: await UserModel.findById(user._id).select(
          '-__v -password -invite -lastDomainAddition -lastFileArchive -emailVerified  -emailVerificationKey -strikes -bypassAltCheck'
        ),
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

router.get('/logout', async (req: Request, res: Response) => {
  const cookie = req.cookies['x-refresh-token'];

  if (!cookie)
    return res.status(401).json({
      success: false,
      error: 'unauthorized',
    });

  try {
    const refreshToken = await RefreshTokenModel.findOne({token: cookie});

    if (!refreshToken)
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
      });

    await refreshToken.remove();
    res.clearCookie('x-refresh-token');

    res.status(200).json({
      success: true,
      message: 'logged out successfully',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
