package com.los.notification.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TemplateDataDto {

    private String templateId;

    private String templateName;

    private String channel;

    private String titleTemplate;

    private String messageTemplate;

    private String variables;

    private Boolean isActive;
}
