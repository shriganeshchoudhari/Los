import * as crypto from 'crypto';

export interface JWK {
  kty: string;
  use: string;
  kid: string;
  alg: string;
  n: string;
  e: string;
}

export class JwtKeyManager {
  private privateKey: crypto.KeyObject;
  private publicKey: crypto.KeyObject;
  private readonly kid: string;
  private readonly algorithm = 'RSA-SHA256';

  constructor(privateKeyPem?: string) {
    if (privateKeyPem) {
      this.privateKey = crypto.createPrivateKey(privateKeyPem);
      this.publicKey = crypto.createPublicKey(this.privateKey);
    } else {
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      this.privateKey = crypto.createPrivateKey(privateKey);
      this.publicKey = crypto.createPublicKey(this.privateKey);
    }

    const keyId = crypto.createHash('sha256')
      .update(this.publicKey.export({ type: 'spki', format: 'der' }))
      .digest('hex')
      .slice(0, 16);
    this.kid = `los-auth-${keyId}`;
  }

  getKid(): string {
    return this.kid;
  }

  getPrivateKey(): crypto.KeyObject {
    return this.privateKey;
  }

  getPublicKeyPem(): string {
    return this.publicKey.export({ type: 'spki', format: 'pem' });
  }

  toJWK(): JWK {
    const der = this.publicKey.export({ type: 'spki', format: 'der' });
    const base64Url = (b: Buffer) => b.toString('base64url');

    const modulus = der.slice(22);
    const exponent = der.slice(der.length - 3);

    return {
      kty: 'RSA',
      use: 'sig',
      kid: this.kid,
      alg: 'RS256',
      n: base64Url(modulus),
      e: base64Url(exponent),
    };
  }

  toJWKS(): { keys: JWK[] } {
    return { keys: [this.toJWK()] };
  }
}
