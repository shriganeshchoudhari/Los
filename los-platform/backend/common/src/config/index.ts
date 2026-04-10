export interface AppConfig {
  environment: 'development' | 'staging' | 'production';
  name: string;
  version: string;
  port: number;
  apiPrefix: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  synchronize: boolean;
  logging: boolean;
  poolSize: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

export interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
  publicKeyPath: string;
  privateKeyPath: string;
}

export interface EncryptionConfig {
  algorithm: string;
  keyPath: string;
}

export interface UidaiConfig {
  baseUrl: string;
  asaCode: string;
  asaLicenseKey: string;
  publicCertPath: string;
}

export interface NsdlConfig {
  baseUrl: string;
  apiKey: string;
  secretKey: string;
}

export interface BureauConfig {
  cibil: {
    baseUrl: string;
    apiKey: string;
    memberId: string;
  };
  experian: {
    baseUrl: string;
    apiKey: string;
  };
  equifax: {
    baseUrl: string;
    apiKey: string;
  };
  crif: {
    baseUrl: string;
    apiKey: string;
  };
}

export interface CbsConfig {
  system: 'FINACLE' | 'BANCS' | 'FLEXCUBE' | 'TEMENOS';
  baseUrl: string;
  username: string;
  password: string;
  connectionPoolMin: number;
  connectionPoolMax: number;
  timeout: number;
}

export interface NpciConfig {
  baseUrl: string;
  merchantId: string;
  apiKey: string;
}

export interface SmsConfig {
  provider: 'KALEYRA' | 'MSG91';
  apiKey: string;
  senderId: string;
}

export interface EmailConfig {
  provider: 'SENDGRID';
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

export interface ObjectStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface VaultConfig {
  url: string;
  token: string;
  prefix: string;
}
