/**
 * @description null
 * @param {ParamsType} params list of command parameters
 * @param {?string} commandText text message
 * @param {!object} [secrets = {}] list of secrets
 * @return {Promise<SlackBodyType>} Response body
 */
async function _command(params, commandText, secrets = {}) {
  const {ibmApiKey, ibmNamespaceId, ibmRegionCode = 'eu-gb'} = secrets;
  if (!ibmApiKey) {
    return {
      response_type: 'ephemeral',
      text: `We need a secret named \`ibmApiKey\` to run this command. Create one using \`/nc secret_create\``
    };
  }

  const {namespaceId = ibmNamespaceId, skip = 0} = params;
  if (!namespaceId) {
    return {
      response_type: 'ephemeral',
      text: `Namespace ID couldn't be found. Please pass the namespace as parameter to the command or create a secret named \`ibmNamespaceId\`.`
    };
  }

  const result = [];
  const axios = require('axios');

  // Get the access token.
  const body = `grant_type=${encodeURIComponent(
    'urn:ibm:params:oauth:grant-type:apikey'
  )}&apikey=${encodeURIComponent(ibmApiKey)}`;
  const {
    data: {access_token, token_type}
  } = await axios.post('https://iam.cloud.ibm.com/identity/token', body, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    }
  });

  const baseURL = `https://${ibmRegionCode}.functions.cloud.ibm.com/api/v1`;
  const {data} = await axios.get(
    `${baseURL}/namespaces/${namespaceId}/activations?limit=9&skip=${Number(
      skip
    )}`,
    {
      headers: {
        authorization: token_type + ' ' + access_token,
        accept: 'application/json'
      }
    }
  );

  const getStatusMessage = (code) => {
    if (code === 0) {
      return 'sucess';
    } else if (code === 1) {
      return 'application error';
    } else if (code === 2) {
      return 'developer error';
    } else {
      return 'system error';
    }
  };

  for (const activation of data) {
    const output = `\`${
      new Date(activation.start).toISOString().replace('T', ' ').split('.')[0]
    }\` ID: \`${activation.activationId}\` duration: \`${
      activation.duration
    }ms\`\nstatus: \`${getStatusMessage(activation.statusCode)}\` name: \`${
      activation.name
    }\` runtime: \`${activation.annotations[2].value}\``;

    result.push({
      text: output,
      color: activation.statusCode === 0 ? 'good' : 'danger'
    });
  }

  result.push({
    blocks: [
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Powered by <https://nimbella.com/product/commander|Nimbella Commander>.`
          }
        ]
      }
    ]
  });

  return {
    response_type: 'in_channel',
    attachments: result
  };
}

/**
 * @typedef {object} SlackBodyType
 * @property {string} text
 * @property {'in_channel'|'ephemeral'} [response_type]
 */
const main = async (args) => ({
  body: await _command(
    args.params,
    args.commandText,
    args.__secrets || {}
  ).catch((error) => ({
    response_type: 'ephemeral',
    text: `Error: ${error.message}`
  }))
});
module.exports = main;
