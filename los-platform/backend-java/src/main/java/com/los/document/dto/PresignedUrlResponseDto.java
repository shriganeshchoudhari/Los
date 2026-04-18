package com.los.document.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PresignedUrlResponseDto {

    private String documentId;

    private String presignedUrl;

    private String expiresAt;

    private String bucketName;

    private String objectKey;

    private String uploadId;
}
