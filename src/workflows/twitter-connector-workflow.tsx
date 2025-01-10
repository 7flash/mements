// @ts-nocheck

import React from "react";
import executePrompt from "uai/src/uai.ts";

/*
todo: implement this workflow for a first of a kind terminal-type agents who is not using prompt or ai here but instead it simply can handle a defined list of commands aka in this particular scenario what it should do is probably only accepts user message in fromFields that starting with "/request" or "/approve" and otherwise just return { success: false } explaining why its invalid command

so the purpose of this script exec method should be about retrieving oAuthAccess like this:

import OAuth from 'oauth-1.0a';
import readline from 'readline';
import { URL, URLSearchParams } from 'url';
import path from 'path';

const consumer_key = process.env.TWITTER_API_KEY!;
console.log("consumer_key ==> ", consumer_key);
const consumer_secret = process.env.TWITTER_API_SECRET!;
console.log("consumer_secret ==> ", consumer_secret);

const data = {
  "text": "Hello, world!"
};

const endpointURL = `https://api.twitter.com/2/tweets`;

const requestTokenURL = 'https://api.twitter.com/oauth/request_token?oauth_callback=oob&x_auth_access_type=write';
const authorizeURL = new URL('https://api.twitter.com/oauth/authorize');
const accessTokenURL = 'https://api.twitter.com/oauth/access_token';

const oauth = new OAuth({
    consumer: {
        key: consumer_key,
        secret: consumer_secret
    },
    signature_method: 'HMAC-SHA1',
    hash_function: (baseString, key) => {
        const hasher = new Bun.CryptoHasher('sha1', key);
        hasher.update(baseString);
        return hasher.digest('base64');
    }
});

async function input(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function requestToken() {
  const authHeader = oauth.toHeader(oauth.authorize({
    url: requestTokenURL,
    method: 'POST'
  }));

  const response = await fetch(requestTokenURL, {
    method: 'POST',
    headers: {
      Authorization: authHeader["Authorization"]
    }
  });
  
  const body = await response.text();
  if (body) {
    return new URLSearchParams(body);
  } else {
    throw new Error('Cannot get an OAuth request token');
  }
}

async function accessToken(oauth_token: string, verifier: string) {
  const authHeader = oauth.toHeader(oauth.authorize({
    url: accessTokenURL,
    method: 'POST',
    data: { oauth_verifier: verifier }
  }));

  const requestUrl = `${accessTokenURL}?oauth_verifier=${verifier}&oauth_token=${oauth_token}`;
  console.log("requestUrl ==> ", requestUrl);

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      Authorization: authHeader["Authorization"]
    }
  });

  const body = await response.text();
  if (body) {
    return new URLSearchParams(body);
  } else {
    throw new Error('Cannot get an OAuth access token');
  }
}

async function getRequest({ oauth_token, oauth_token_secret }: { oauth_token: string; oauth_token_secret: string }) {
  const token = {
    key: oauth_token,
    secret: oauth_token_secret
  };
  console.log("token ==> ", token);

  const authHeader = oauth.toHeader(oauth.authorize({
    url: endpointURL,
    method: 'POST'
  }, token));
  console.log("authHeader ==> ", authHeader);

  const response = await fetch(endpointURL, {
    method: 'POST',
    headers: {
      Authorization: authHeader["Authorization"],
      'user-agent': "v2CreateTweetJS",
      'content-type': "application/json",
      'accept': "application/json"
    },
    body: JSON.stringify(data)
  });

  const json = await response.json();
  if (json) {
    return json;
  } else {
    throw new Error('Unsuccessful request');
  }
}

const tokenFilePath = path.join(process.cwd(), 'static', 'tokens/oAuthAccessToken.json');

async function saveAccessToken(oAuthAccessToken: URLSearchParams) {
  const tokenData = {
    oauth_token: oAuthAccessToken.get('oauth_token'),
    oauth_token_secret: oAuthAccessToken.get('oauth_token_secret'),
    user_id: oAuthAccessToken.get('user_id'),
    screen_name: oAuthAccessToken.get('screen_name')
  };
  await Bun.write(tokenFilePath, JSON.stringify(tokenData, null, 2));
}

async function loadAccessToken(): Promise<URLSearchParams | null> {
  if (await Bun.file(tokenFilePath).exists()) {
    const tokenData = await Bun.file(tokenFilePath).json();
    if (tokenData.oauth_token && tokenData.oauth_token_secret) {
      return new URLSearchParams(tokenData);
    }
  }
  return null;
}

(async () => {
  try {
    let oAuthAccessToken = await loadAccessToken();

    if (!oAuthAccessToken) {
      const oAuthRequestToken = await requestToken();
      console.log("oAuthRequestToken ==> ", oAuthRequestToken);

      authorizeURL.searchParams.append('oauth_token', oAuthRequestToken.get('oauth_token'));
      console.log('Please go here and authorize:', authorizeURL.href);
      const pin = await input('Paste the PIN here: ');

      oAuthAccessToken = await accessToken(oAuthRequestToken.get('oauth_token')!, pin.trim());
      console.log("oAuthAccessToken ==> ", oAuthAccessToken);

      await saveAccessToken(oAuthAccessToken);
    }

    const response = await getRequest({
      oauth_token: oAuthAccessToken.get('oauth_token')!,
      oauth_token_secret: oAuthAccessToken.get('oauth_token_secret')!
    });
    console.dir(response, {
      depth: null
    });

    const screen_name = oAuthAccessToken.get('screen_name');
    const tweet_id = response.data.id;
    console.log(`https://twitter.com/${screen_name}/status/${tweet_id}`);

  } catch (e) {
    console.error(e);
    process.exit(-1);
  }
})();

---

then following it should use these retrieve oauth to update agent like this

async function main() {
  const args = parseArgs({
    args: Bun.argv,
    options: {
      filePath: {
        type: 'string',
      },
    },
    strict: true,
    allowPositionals: true,
  });

  const filePath = path.join(process.cwd(), args.values.filePath!);
  console.log("filePath ==> ", filePath);

  const fileContent = await Bun.file(filePath).text();

  let parsedData;
  if (filePath.endsWith('.toml')) {
    parsedData = (await import(filePath)).default;
  } else {
    console.error('Unsupported file format. Please provide a .toml or .md file.');
    process.exit(1);
  }

  console.log("parsedData ==> ", parsedData);

  try {
      const response = await fetch(`http://localhost:${process.env.BUN_PORT}/createAgent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CREATE_AGENT_SECRET}`
        },
        body: JSON.stringify(parsedData),
      });
      console.log("response ==> ", await response.text());
    } catch (error) {
    console.error('Error creating agent:', error);
    process.exit(1);
  }
}

where in our /createAgent request we pass a path to the file config that looks like this

[twitterBot]
oauth_token = ""
oauth_token_secret = ""
user_id = ""
screen_name = ""

and in the successful result of exec function we must return a message saying that agent account has been connected and maybe we still can use prompt for it to make it more conversational message that will be posted to twitter of this twitter-terminal agent itself

we should also write an announcement about new type of mements coming soon, and asking what kind of terminal agents youd like to create? explaining its different in a sense that only accepts a defined list of commands and actions
*/

export default {
    fromFields: {},
    toFields: {},
    instruction: "",

    from(fields: { [key: string]: any }) {
        this.fromFields = fields;
        return this;
    },

    to(fields: { [key: string]: any }) {
        this.toFields = fields;
        return this;
    },

    async exec(instruction: string) {
        this.instruction = instruction;

        const formatFromFields = Object.keys(this.fromFields).map((key) => {
            return {
                tagName: key,
                fieldDescription: this.fromFields[key],
            };
        });

        const formatToFields = Object.keys(this.toFields).map((key) => {
            return {
                tagName: key,
                fieldDescription: this.toFields[key],
            };
        });

        const tagsOfFromFields = formatFromFields.map((it) => {
            const TagName = it.tagName;
            return <TagName>{it.fieldDescription}</TagName>;
        });

        const tagsOfToFields = formatToFields.map((it) => {
            const TagName = it.tagName;
            return <TagName>{it.fieldDescription}</TagName>;
        });

        const result = await executePrompt(<>
            <settings temperature={0.0} enablesPrediction={false} />
            <system>
                <instruction>{this.instruction}</instruction>
                <responseFormat>
                    <thinking>THINK carefully before responding.</thinking>
                    <requiredFields>
                        {tagsOfToFields}
                    </requiredFields>
                </responseFormat>
            </system>
            <user>
                <context>
                    {tagsOfFromFields}
                </context>
            </user>
        </>);
        console.log("result ==> ", result);

        return result;
    },
};