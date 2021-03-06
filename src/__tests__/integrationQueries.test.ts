import * as faker from 'faker';
import { graphqlRequest } from '../db/connection';
import { brandFactory, channelFactory, integrationFactory, tagsFactory } from '../db/factories';
import { Brands, Channels, Integrations, Tags } from '../db/models';
import { TAG_TYPES } from '../db/models/definitions/constants';

import { IntegrationsAPI } from '../data/dataSources';
import './setup.ts';

describe('integrationQueries', () => {
  const qryIntegrations = `
    query integrations(
      $page: Int
      $perPage: Int
      $kind: String
      $searchValue: String
      $channelId: String
      $brandId: String
      $tag: String
    ) {
      integrations(
        page: $page
        perPage: $perPage
        kind: $kind
        searchValue: $searchValue
        channelId: $channelId
        brandId: $brandId
        tag: $tag
      ) {
        _id
      }
    }
  `;

  const qryCount = `
    query integrationsTotalCount {
      integrationsTotalCount {
        total
        byTag
        byKind
        byBrand
        byChannel
      }
    }
  `;

  const name = faker && faker.random ? faker.random.word() : 'anonymous';

  afterEach(async () => {
    // Clearing test data
    await Integrations.deleteMany({});
    await Channels.deleteMany({});
    await Brands.deleteMany({});
    await Tags.deleteMany({});
  });

  test('Integrations', async () => {
    await integrationFactory({});
    await integrationFactory({});
    await integrationFactory({});
    await integrationFactory({});

    const responses = await graphqlRequest(qryIntegrations, 'integrations', {
      page: 1,
      perPage: 3,
    });

    expect(responses.length).toBe(3);
  });

  test('Integrations filtered by tag', async () => {
    await integrationFactory({});
    await integrationFactory({});
    await integrationFactory({});

    const tagObj = await tagsFactory({ type: TAG_TYPES.INTEGRATION });
    await integrationFactory({ tagIds: [tagObj._id] });

    const responses = await graphqlRequest(qryIntegrations, 'integrations', {
      page: 1,
      perPage: 20,
      tag: tagObj._id,
    });

    expect(responses.length).toBe(1);
  });

  test('Integrations filtered by kind', async () => {
    await integrationFactory({ kind: 'messenger' });
    await integrationFactory({ kind: 'lead' });

    // messenger ========================
    let responses = await graphqlRequest(qryIntegrations, 'integrations', {
      kind: 'messenger',
    });

    expect(responses.length).toBe(1);

    // lead =========================
    responses = await graphqlRequest(qryIntegrations, 'integrations', {
      kind: 'lead',
    });

    expect(responses.length).toBe(1);
  });

  test('Integrations filtered by mail', async () => {
    await integrationFactory({ kind: 'gmail' });
    await integrationFactory({ kind: 'nylas-gmail' });

    // mail ========================
    const responses = await graphqlRequest(qryIntegrations, 'integrations', {
      kind: 'mail',
    });

    expect(responses.length).toBe(2);
  });

  test('Integrations filtered by channel', async () => {
    const integration1 = await integrationFactory({ kind: 'facebook-messenger' });
    const integration2 = await integrationFactory({ kind: 'facebook-messenger' });

    await integrationFactory({ kind: 'facebook-messenger' });

    const integrationIds = [integration1._id, integration2._id];

    const channel = await channelFactory({ integrationIds });

    const responses = await graphqlRequest(qryIntegrations, 'integrations', {
      channelId: channel._id,
    });

    expect(responses.length).toBe(2);
  });

  test('Integrations filtered by brand', async () => {
    const brand = await brandFactory();

    await integrationFactory({ kind: 'messenger', brandId: brand._id });
    await integrationFactory({ kind: 'lead', brandId: brand._id });
    await integrationFactory({ kind: 'lead', brandId: 'fakeId' });

    const responses = await graphqlRequest(qryIntegrations, 'integrations', {
      brandId: brand._id,
    });

    expect(responses.length).toBe(2);
  });

  test('Integrations filtered by search value', async () => {
    // default value of kind is 'messenger' in factory
    await integrationFactory({ name });
    await integrationFactory({});

    const responses = await graphqlRequest(qryIntegrations, 'integrations', {
      searchValue: name,
    });

    expect(responses.length).toBe(1);
  });

  test('Integration detail', async () => {
    const qry = `
      query integrationDetail($_id: String!) {
        integrationDetail(_id: $_id) {
          _id
          kind
          name
          brandId
          languageCode
          code
          formId
          leadData
          messengerData
          uiOptions

          brand { _id }
          form { _id }
          channels { _id }
          tags { _id }
        }
      }
    `;

    const tag = await tagsFactory();
    const integration = await integrationFactory({ tagIds: [tag._id], brandId: 'fakeId' });

    const response = await graphqlRequest(qry, 'integrationDetail', {
      _id: integration._id,
    });

    expect(response._id).toBe(integration._id);
    expect(response.tags.length).toBe(1);
  });

  test('Get total count of integrations by kind', async () => {
    await integrationFactory({ kind: 'messenger' });
    await integrationFactory({ kind: 'lead' });

    // messenger =========================
    let response = await graphqlRequest(qryCount, 'integrationsTotalCount', {});

    expect(response.byKind.messenger).toBe(1);

    // lead =============================
    response = await graphqlRequest(qryCount, 'integrationsTotalCount', {});

    expect(response.byKind.lead).toBe(1);
  });

  test('Get total count of integrations by channel', async () => {
    const integration1 = await integrationFactory({});
    const integration2 = await integrationFactory({});

    await integrationFactory({});

    const integrationIds = [integration1._id, integration2._id];

    const channel = await channelFactory({ integrationIds });

    const response = await graphqlRequest(qryCount, 'integrationsTotalCount', {});

    expect(response.byChannel[channel._id]).toBe(2);
  });

  test('Get total count of integrations by brand', async () => {
    const brand = await brandFactory();

    await integrationFactory({ kind: 'messenger', brandId: brand._id });
    await integrationFactory({ kind: 'lead', brandId: brand._id });
    await integrationFactory({ kind: 'lead' });

    const response = await graphqlRequest(qryCount, 'integrationsTotalCount', {});

    expect(response.byBrand[brand._id]).toBe(2);
  });

  test('Get total count of integrations by tag', async () => {
    await integrationFactory({});
    await integrationFactory({});
    await integrationFactory({});

    const tagObj = await tagsFactory({ type: TAG_TYPES.INTEGRATION });
    await integrationFactory({ tagIds: [tagObj._id] });

    const responses = await graphqlRequest(qryCount, 'integrationsTotalCount');

    expect(responses.byTag[tagObj._id]).toBe(1);
  });

  test('Fetch integration api', async () => {
    process.env.INTEGRATIONS_API_DOMAIN = 'http://fake.erxes.io';

    const qry = `
      query integrationsFetchApi($path: String!, $params: JSON!) {
        integrationsFetchApi(path: $path, params: $params)
      }
    `;

    const dataSources = { IntegrationsAPI: new IntegrationsAPI() };

    try {
      await graphqlRequest(qry, 'integrationsFetchApi', { path: '/', params: { type: 'facebook' } }, { dataSources });
    } catch (e) {
      expect(e[0].message).toBe('Integrations api is not running');
    }
  });

  test('Get used types', async () => {
    const qry = `
      query integrationsGetUsedTypes {
        integrationsGetUsedTypes {
          _id
          name
        }
      }
    `;

    await integrationFactory({ kind: 'messenger' });

    const usedTypes = await graphqlRequest(qry, 'integrationsGetUsedTypes');

    expect(usedTypes[0]._id).toBe('messenger');
    expect(usedTypes[0].name).toBe('Web messenger');
  });
});
