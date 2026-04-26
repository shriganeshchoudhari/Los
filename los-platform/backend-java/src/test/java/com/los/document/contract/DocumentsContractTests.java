package com.los.document.contract;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
public class DocumentsContractTests {

    @Autowired
    private MockMvc mvc;

    @Test
    void presignedUrlAcceptsPayload() throws Exception {
        String payload = "{\"applicationId\": \"11111111-1111-1111-1111-111111111111\", \"documentName\": \"test.pdf\", \"documentType\": \"BANK_STATEMENT\", \"contentType\": \"application/pdf\"}";
        mvc.perform(post("/api/documents/presigned-url").contentType("application/json").content(payload))
                .andExpect(status().isOk());
    }

    @Test
    void watermarkEndpointAcceptsPayload() throws Exception {
        // We need a valid document ID from seed or created in test
        // From V013/V012? No, documents are not seeded yet.
        // Let's create one via the API first
        String presignedPayload = "{\"applicationId\": \"11111111-1111-1111-1111-111111111111\", \"documentName\": \"test.pdf\", \"documentType\": \"BANK_STATEMENT\", \"contentType\": \"application/pdf\"}";
        String response = mvc.perform(post("/api/documents/presigned-url").contentType("application/json").content(presignedPayload))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        
        String documentId = response.split("\"documentId\":\"")[1].split("\"")[0];

        String payload = "{\"documentId\": \"" + documentId + "\", \"applicationId\": \"11111111-1111-1111-1111-111111111111\", \"watermarkText\": \"CONFIDENTIAL\"}";
        mvc.perform(post("/api/documents/" + documentId + "/watermark").contentType("application/json").content(payload))
                .andExpect(status().isOk());
    }
}
