package com.los.common.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "los")
public class LosProperties {

    private Jwt jwt = new Jwt();
    private Encryption encryption = new Encryption();
    private Otp otp = new Otp();
    private Redis redis = new Redis();
    private Minio minio = new Minio();
    private Kyc kyc = new Kyc();

    @Data
    public static class Jwt {
        private String publicKeyFile;
        private String privateKeyFile;
        private String issuer;
        private int accessTokenExpirySeconds;
        private int refreshTokenExpiryDays;
    }

    @Data
    public static class Encryption {
        private String masterKey;
    }

    @Data
    public static class Otp {
        private int ttlSeconds;
        private int maxAttempts;
        private int maxPerHour;
        private int maxConcurrentSessions;
    }

    @Data
    public static class Redis {
        private String otpPrefix;
        private String sessionPrefix;
        private String blacklistPrefix;
    }

    @Data
    public static class Minio {
        private String endpoint;
        private int port;
        private String accessKey;
        private String secretKey;
        private String bucket;
    }

    @Data
    public static class Kyc {
        private Uidai uidai = new Uidai();
        private Nsdl nsdl = new Nsdl();
        private FaceMatch faceMatch = new FaceMatch();
        private Digilocker digilocker = new Digilocker();

        @Data
        public static class Uidai {
            private String baseUrl;
            private String asaCode;
            private String publicKey;
        }

        @Data
        public static class Nsdl {
            private String baseUrl;
            private String apiKey;
        }

        @Data
        public static class FaceMatch {
            private String url;
        }

        @Data
        public static class Digilocker {
            private String clientId;
            private String clientSecret;
            private String redirectUri;
        }
    }
}
