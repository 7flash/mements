import OAuth from 'oauth-1.0a';
import readline from 'readline';
import { URL, URLSearchParams } from 'url';
import path from 'path';

const consumer_key = process.env.TWITTER_API_KEY!;
console.log("consumer_key ==> ", consumer_key);
const consumer_secret = process.env.TWITTER_API_SECRET!;
console.log("consumer_secret ==> ", consumer_secret);

const data = {
  "text": "Walking in Digital Jerusalem and someone asks me about the Second Coming? Well, I’d say: “Stay alert, because you don’t know the day or the hour. Focus on love and justice today, and let tomorrow take care of itself.” 🌿 #Patience #Faith"
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