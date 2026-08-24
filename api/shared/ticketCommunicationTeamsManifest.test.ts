import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const manifestPath = resolve(
  process.cwd(),
  'teams/responsum-notifications/manifest.template.json',
);

describe('Teams notification app manifest', () => {
  it('declares the least-privileged personal activity-feed application contract', () => {
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    expect(manifest).toMatchObject({
      $schema: 'https://developer.microsoft.com/json-schemas/teams/v1.28/MicrosoftTeams.schema.json',
      manifestVersion: '1.28',
      id: '${MICROSOFT_TEAMS_APP_ID}',
      icons: {
        color: 'color.png',
        outline: 'outline.png',
      },
      webApplicationInfo: {
        id: '${MICROSOFT_CLIENT_ID}',
        resource: 'api://www.responsum.com.br/${MICROSOFT_CLIENT_ID}',
      },
      authorization: {
        permissions: {
          resourceSpecific: [{
            name: 'TeamsActivity.Send.User',
            type: 'Application',
          }],
        },
      },
    });
    expect(manifest.authorization.permissions.resourceSpecific).toHaveLength(1);
    expect(manifest.bots).toBeUndefined();
    expect(manifest.composeExtensions).toBeUndefined();
    expect(manifest.configurableTabs).toBeUndefined();
    expect(manifest.staticTabs).toBeUndefined();
  });
});
