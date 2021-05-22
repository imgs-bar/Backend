import Axios from 'axios';
import {Domain} from '../models/DomainModel';
import {User} from '../models/UserModel';

/**
 * Log a list of new domains to the domain notifications channel.
 * @param {Domain[]} domains The domain that was created.
 * @param {User} donatedby The donator
 */
async function logDomains(domains: Domain[], donatedby: User) {
  const grammar =
    domains.length > 1
      ? `**${domains.length}** new domains have`
      : 'A new domain has';
  const domainList = domains
    .map(d => (d.wildcard ? '*.' : '') + d.name)
    .join(',\n');

  await Axios.post(process.env.WEBHOOK_URL, {
    embeds: [
      {
        description: `${grammar} been added, they will be available soon.`,
        fields: [
          {
            name: 'Domains',
            value: `\`\`\`${domainList}\`\`\``,
          },
          {
            name: 'Donated By:',
            value: !donatedby
              ? `Official Domain${domains.length > 1 ? 's' : ''}`
              : `${donatedby.username} (<@${donatedby.discord.id}>)`,
          },
        ],
      },
    ],
  });
}

/**
 * Log a single custom domain to the webhook in the server.
 * @param {Domain} domain The domain.
 */
async function logCustomDomain(domain: Domain) {
  await Axios.post(process.env.CUSTOM_DOMAIN_WEBHOOK, {
    embeds: [
      {
        title: 'A new domain has been added',
        fields: [
          {
            name: 'Name',
            value: `[${domain.name}](https://${domain.name})`,
          },
          {
            name: 'Wildcard',
            value: domain.wildcard ? 'Yes' : 'No',
          },
          {
            name: 'Donator',
            value: domain.donatedBy,
          },
        ],
      },
    ],
  });
}

export {logDomains, logCustomDomain};
