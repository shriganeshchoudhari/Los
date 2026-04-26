package com.los.decision.contract;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
public class DecisionContractTests {

    @Autowired
    private MockMvc mvc;

    private String applicationId = "55555555-5555-5555-5555-555555555555";

    @Test
    void triggerDecisionAcceptsAliasContextData() throws Exception {
        String payload = "{\"applicationId\": \"" + applicationId + "\", \"forceRerun\": true}";
        mvc.perform(post("/api/decisions/trigger")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andDo(org.springframework.test.web.servlet.result.MockMvcResultHandlers.print())
                .andExpect(status().isOk());
    }

    @Test
    void manualOverrideAcceptsFinalDecision() throws Exception {
        // First trigger to ensure decision exists
        mvc.perform(post("/api/decisions/trigger")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"applicationId\": \"" + applicationId + "\", \"forceRerun\": true}"))
                .andExpect(status().isOk());

        String payload = "{\"applicationId\": \"" + applicationId + "\", \"status\": \"APPROVED\", \"decision\": \"APPROVE\", \"remarks\": \"Manual override test\"}";
        mvc.perform(post("/api/decisions/override")
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
                .andDo(org.springframework.test.web.servlet.result.MockMvcResultHandlers.print())
                .andExpect(status().isOk());
    }

    @Test
    void endToEndDecisionFlowCanonical() throws Exception {
        mvc.perform(post("/api/decisions/trigger")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"applicationId\": \"" + applicationId + "\", \"forceRerun\": false}"))
                .andDo(org.springframework.test.web.servlet.result.MockMvcResultHandlers.print())
                .andExpect(status().isOk());
        
        mvc.perform(get("/api/decisions/" + applicationId))
                .andExpect(status().isOk());
    }
}
