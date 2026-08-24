import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const manifestPath = resolve(
  process.cwd(),
  'teams/responsum-notifications/manifest.template.json',
);

describe('Teams notification app manifest', () => {
  it('declares only the least-privileged personal activity-feed contract', () => {
    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    expect(Object.keys(manifest).sort()).toEqual([
      '$schema',
      'accentColor',
      'activities',
      'authorization',
      'description',
      'developer',
      'icons',
      'id',
      'manifestVersion',
      'name',
      'validDomains',
      'version',
      'webApplicationInfo',
    ].sort());
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
      activities: {
        activityTypes: [{
          type: 'ticketCommunication',
          description: 'Aviso de chamado que requer atenção no Responsum.',
          templateText: '{actor} enviou um aviso de chamado: {notificationText}',
        }],
      },
    });
    expect(Object.keys(manifest.icons).sort()).toEqual(['color', 'outline']);
    expect(Object.keys(manifest.webApplicationInfo).sort()).toEqual(['id', 'resource']);
    expect(Object.keys(manifest.authorization)).toEqual(['permissions']);
    expect(Object.keys(manifest.authorization.permissions)).toEqual(['resourceSpecific']);
    expect(manifest.authorization.permissions.resourceSpecific).toHaveLength(1);
    expect(Object.keys(manifest.authorization.permissions.resourceSpecific[0]).sort()).toEqual(['name', 'type']);
    expect(Object.keys(manifest.activities)).toEqual(['activityTypes']);
    expect(manifest.activities.activityTypes).toHaveLength(1);
    expect(Object.keys(manifest.activities.activityTypes[0]).sort()).toEqual([
      'description',
      'templateText',
      'type',
    ]);
    for (const forbiddenProperty of [
      'bots',
      'composeExtensions',
      'configurableTabs',
      'connectors',
      'devicePermissions',
      'permissions',
      'staticTabs',
      'subscriptionOffer',
    ]) {
      expect(manifest).not.toHaveProperty(forbiddenProperty);
    }
  });
});
