// Generated from the backend's routes. Do not edit: run `pnpm contract` in backend/.

export interface paths {
    "/auth/demo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Try the demo account: a form the page posts, answered with a redirect into the app (DS-FR-06) */
        post: {
            parameters: {
                query?: {
                    next?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Signed in to a new demo account and sent to `next` or /deals; or to /sign-in?problem=demo_limit */
                303: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/sign-out": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Sign out (DS-FR-05) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Signed out, or nobody was signed in */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": Record<string, never>;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The signed-in creator (DS-FR-08) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The creator's profile */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Profile"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/welcomed": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Record that the creator has seen the welcome page (DS-FR-09) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The creator's profile */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Profile"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/me/paypal-email": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Save the PayPal email the creator is paid at (DS-FR-10) */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: email */
                        email: string;
                    };
                };
            };
            responses: {
                /** @description The creator's profile */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Profile"];
                    };
                };
                /** @description The email is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/deals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The creator's deals (DS-FR-14) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The creator's own deals, newest first */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DealSummary"][];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        /** Start a deal (DS-FR-13) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        brandName: string;
                        deliverables: {
                            /** @enum {string} */
                            platform: "youtube_video" | "youtube_short" | "instagram_reel";
                        }[];
                    };
                };
            };
            responses: {
                /** @description The new deal */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DealDraft"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/deals/{dealId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** One deal (DS-FR-15) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The deal */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DealDraft"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, or it is not this creator's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Change the brand or the posts, before the brief is sent (DS-FR-16) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        brandName: string;
                        deliverables: {
                            id?: string;
                            /** @enum {string} */
                            platform: "youtube_video" | "youtube_short" | "instagram_reel";
                        }[];
                    };
                };
            };
            responses: {
                /** @description The deal as changed */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DealDraft"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, or it is not this creator's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The brief has been sent */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/deals/{dealId}/brief": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Send the brief; reading starts as a job (DS-FR-17) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        text: string;
                    };
                };
            };
            responses: {
                /** @description The deal, with its brief as numbered lines, being read */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DealDraft"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, or it is not this creator's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The brief is being read or has been read */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description A limit on reading briefs was reached */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/deals/{dealId}/questions/{questionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Answer a question about an unclear line of the brief (DS-FR-23) */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                    questionId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        kind: "suggestion" | "own_words" | "left_out";
                        text?: string;
                    };
                };
            };
            responses: {
                /** @description The deal as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DealDraft"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, or it is not this creator's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The checklist cannot be changed now */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        post?: never;
        /** Reopen an answered question (DS-FR-23) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                    questionId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The deal as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DealDraft"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, or it is not this creator's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The checklist cannot be changed now */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/deals/{dealId}/items/{itemId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Remove an item (DS-FR-24) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                    itemId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The deal as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DealDraft"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, or it is not this creator's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The checklist cannot be changed now */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** Reword an item; its citation stays (DS-FR-24) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                    itemId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name: string;
                    };
                };
            };
            responses: {
                /** @description The deal as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DealDraft"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, or it is not this creator's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The checklist cannot be changed now */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/deals/{dealId}/items/{itemId}/copy": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Copy an item to another of the deal's posts (DS-FR-24) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                    itemId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        deliverableId: string;
                    };
                };
            };
            responses: {
                /** @description The deal as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DealDraft"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, or it is not this creator's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The checklist cannot be changed now */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/deals/{dealId}/items/{itemId}/move": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Move an item to another of the deal's posts (DS-FR-24) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                    itemId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        deliverableId: string;
                    };
                };
            };
            responses: {
                /** @description The deal as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DealDraft"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, or it is not this creator's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The checklist cannot be changed now */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/deals/{dealId}/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Add an item of the creator's own, not from the brief (DS-FR-24) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        deliverableId: string;
                        name: string;
                        /** @enum {string} */
                        kind: "said" | "shown_as_text" | "shown" | "timing" | "written" | "disclosure" | "publication";
                    };
                };
            };
            responses: {
                /** @description The deal as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DealDraft"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, or it is not this creator's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The checklist cannot be changed now */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/deals/{dealId}/checklist/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Mark the checklist ready; the deal moves to the invite step (DS-FR-25) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The deal as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DealDraft"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, or it is not this creator's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The checklist cannot be changed now */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/deals/{dealId}/checklist/reopen": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Go back to the checklist step, to edit it again (DS-FR-25) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The deal as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DealDraft"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, or it is not this creator's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The checklist cannot be changed now */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/deals/{dealId}/invite": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The deal's terms and the brand's link (DS-FR-29, DS-FR-32) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The invite as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Invite"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, it is not this creator's, or it has not reached the invite step */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Keep the brand's email, or take it away with null; nothing is sent to it (DS-FR-30) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: email */
                        brandEmail: string | null;
                    };
                };
            };
            responses: {
                /** @description The invite as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Invite"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, it is not this creator's, or it has not reached the invite step */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not allowed at this point of the deal */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/deals/{dealId}/invite/posts/{deliverableId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Set a post's amount, its deadline, or both (DS-FR-29) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                    deliverableId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        amount?: string;
                        deadlineDays?: number;
                    };
                };
            };
            responses: {
                /** @description The invite as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Invite"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, it is not this creator's, or it has not reached the invite step */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not allowed at this point of the deal */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/deals/{dealId}/invite/link": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Make the brand's link; the terms are saved as a version and the deal waits for the brand (DS-FR-31) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        timezone: string;
                    };
                };
            };
            responses: {
                /** @description The invite as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Invite"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, it is not this creator's, or it has not reached the invite step */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not allowed at this point of the deal */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description This service is not set up to make links */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        /** Change terms: the link is turned off and the deal goes back to the invite step (DS-FR-33) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The invite as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Invite"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, it is not this creator's, or it has not reached the invite step */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not allowed at this point of the deal */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description This service is not set up to make links */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/deals/{dealId}/invite/link/renew": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Make a new link: the old one is turned off and a new one returned (DS-FR-33) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The invite as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Invite"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, it is not this creator's, or it has not reached the invite step */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not allowed at this point of the deal */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description This service is not set up to make links */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/deals/{dealId}/notes/{noteId}/reply": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Reply to one of the brand's notes, in plain text (DS-FR-39) */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                    noteId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        reply: string;
                    };
                };
            };
            responses: {
                /** @description The invite as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Invite"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, it is not this creator's, or it has not reached the invite step */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not allowed at this point of the deal */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/deals/{dealId}/invite/send": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Send updated terms: a new version to the same link, which gets 7 more days (DS-FR-40) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The invite as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Invite"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such deal, it is not this creator's, or it has not reached the invite step */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not allowed at this point of the deal */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description This service is not set up to make links */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/deliverables/{deliverableId}/draft": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Send a draft: the video file is the request's body, and its check starts as a job (DR-FR-01, DR-FR-02) */
        post: {
            parameters: {
                query?: {
                    fileName?: string;
                };
                header?: never;
                path: {
                    deliverableId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/octet-stream": string;
                };
            };
            responses: {
                /** @description The draft was taken and is being checked */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DraftAccepted"];
                    };
                };
                /** @description No file was sent */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such post, or it is not this creator's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The post takes no draft now: not held, released, approved, or a check is running */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The file is over the size limit. Nothing of it was kept */
                413: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The file cannot be checked: unreadable, not an MP4 or MOV, or too long (with its length and the cap) */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description A limit on drafts was reached */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description This service is not set up to store drafts */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/deliverables/{deliverableId}/check/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Start the same draft's check again, after it failed on Cleared's side (DR-FR-23) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    deliverableId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The check was started again */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DraftAccepted"];
                    };
                };
                /** @description Nobody is signed in */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No such post, or it is not this creator's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description There is no failed check to start again, or the post is no longer held */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description This service is not set up to store drafts */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/b/{token}/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Swap an invite link's token for a session scoped to its deal (DS-FR-34) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    token: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The deal the link opens. The session is an HttpOnly cookie */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BrandSession"];
                    };
                };
                /** @description The link does not work: expired, turned off or unknown, with no reason given (DS-FR-35) */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/brand/deals/{dealId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** The deal as its brand sees it: the terms, the checklist and where each item came from (DS-FR-36) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The deal, at the latest version sent to the brand */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BrandDeal"];
                    };
                };
                /** @description No session for this deal, whether or not it exists (DS-FR-37) */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/brand/deals/{dealId}/notes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Ask for changes: a set of notes sent together, in plain text (DS-FR-38) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        notes: {
                            about: {
                                /** @enum {string} */
                                kind: "item";
                                itemId: string;
                            } | {
                                /** @enum {string} */
                                kind: "line";
                                briefLine: number;
                            } | {
                                /** @enum {string} */
                                kind: "amount" | "deadline";
                                deliverableId: string;
                            } | {
                                /** @enum {string} */
                                kind: "deal";
                            };
                            text: string;
                        }[];
                    };
                };
            };
            responses: {
                /** @description The deal, now with changes asked */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BrandDeal"];
                    };
                };
                /** @description A note is not valid, or is about something that is not in this deal */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No session for this deal, whether or not it exists (DS-FR-37) */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Notes cannot be sent now: the creator has not answered the last ones, or the deal is agreed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/brand/deals/{dealId}/agree": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Agree to the version shown; each post's money is opened, ready for its hold (DS-FR-41, DS-FR-42) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        version: number;
                    };
                };
            };
            responses: {
                /** @description The deal, agreed */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BrandDeal"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No session for this deal, whether or not it exists (DS-FR-37) */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description Not agreed: the version is out of date, changes are being answered, or it is already agreed */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description This service is not set up to hold money, so nothing can be agreed */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/brand/deals/{dealId}/posts/{deliverableId}/hold": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Start one post's hold: a PayPal order for its amount, for the page's PayPal button (DS-FR-43) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                    deliverableId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The PayPal order to approve */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["HoldStart"];
                    };
                };
                /** @description No session for this deal, whether or not it exists (DS-FR-37) */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The post is not one of this deal's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The money path refused, with its reason as the code (MP-FR-02, MP-FR-03) */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description PayPal gave no clear answer, or this service is not set up to hold money. Try again */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/brand/deals/{dealId}/posts/{deliverableId}/hold/approved": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** PayPal approved the order: it is authorized, and the post's hold is reported as it now stands (DS-FR-44) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                    deliverableId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        orderId: string;
                    };
                };
            };
            responses: {
                /** @description The deal, with the post's hold as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BrandDeal"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No session for this deal, whether or not it exists (DS-FR-37) */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The post is not one of this deal's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The money path refused, with its reason as the code (MP-FR-02, MP-FR-03) */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description PayPal gave no clear answer, or this service is not set up to hold money. Try again */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/brand/deals/{dealId}/posts/{deliverableId}/hold/closed": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** The brand closed PayPal without approving: nothing is held (DS-FR-44) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    dealId: string;
                    deliverableId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        orderId: string;
                    };
                };
            };
            responses: {
                /** @description The deal, with the post's hold as it now stands */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BrandDeal"];
                    };
                };
                /** @description The request is not valid */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description No session for this deal, whether or not it exists (DS-FR-37) */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The post is not one of this deal's */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description The money path refused, with its reason as the code (MP-FR-02, MP-FR-03) */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
                /** @description PayPal gave no clear answer, or this service is not set up to hold money. Try again */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Error"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/google": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Sign in with Google: the browser is sent here, on to Google, and back into the app (DS-FR-01) */
        get: {
            parameters: {
                query?: {
                    next?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description To Google; afterwards to `next`, /deals or /welcome, or to /sign-in?problem=… if it did not work */
                302: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/connect/youtube": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Connect the creator's YouTube channel, read-only: the browser is sent here, on to Google, and back (DS-FR-11) */
        get: {
            parameters: {
                query?: {
                    next?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description To Google; afterwards to `next` or /deals with `connected=youtube`, or `connect=failed`, `declined` or `no_channel` */
                302: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Profile: {
            name: string;
            email?: string;
            demo: boolean;
            welcomed: boolean;
            paypalEmail?: string;
            accounts: {
                /** @enum {string} */
                platform: "youtube";
                name: string;
            }[];
        };
        Error: {
            error: {
                code: string;
                field?: string;
                resetsAt?: string;
                lengthSec?: number;
                lengthCapSec?: number;
            };
        };
        DealDraft: {
            id: string;
            brandName: string;
            /** @enum {string} */
            step: "checklist" | "invite" | "waiting_for_brand" | "changes_requested" | "agreed";
            deliverables: {
                id: string;
                /** @enum {string} */
                platform: "youtube_video" | "youtube_short";
            }[];
            brief?: {
                lines: {
                    number: number;
                    text: string;
                }[];
            };
            /** @enum {string} */
            reading: "idle" | "reading" | "done" | "failed";
            items: {
                id: string;
                deliverableId: string;
                name: string;
                /** @enum {string} */
                kind: "said" | "shown_as_text" | "shown" | "timing" | "written" | "disclosure" | "publication";
                briefLine?: number;
                addedByCreator: boolean;
                /** @enum {string} */
                checkedBy: "exact_match" | "ai_timestamp" | "at_live_check";
            }[];
            questions: {
                id: string;
                briefLine: number;
                text: string;
                suggestions: string[];
                answer?: {
                    /** @enum {string} */
                    kind: "suggestion" | "own_words" | "left_out";
                    text?: string;
                };
            }[];
            ready: boolean;
            notes?: components["schemas"]["Note"][];
        };
        Note: {
            id: string;
            about: {
                /** @enum {string} */
                kind: "item";
                itemId: string;
            } | {
                /** @enum {string} */
                kind: "line";
                briefLine: number;
            } | {
                /** @enum {string} */
                kind: "amount" | "deadline";
                deliverableId: string;
            } | {
                /** @enum {string} */
                kind: "deal";
            };
            text: string;
            reply?: string;
            version: number;
        };
        DealSummary: {
            id: string;
            brandName: string;
            status: string;
            /** @enum {string} */
            step?: "checklist" | "invite" | "waiting_for_brand" | "changes_requested" | "agreed";
            openDeliverableId?: string;
            deliverables: {
                id: string;
                /** @enum {string} */
                platform: "youtube_video" | "youtube_short";
                /** @enum {string} */
                state: "no_draft";
            }[];
        };
        Invite: {
            dealId: string;
            brandName: string;
            /** @enum {string} */
            step: "invite" | "waiting_for_brand" | "changes_requested" | "agreed";
            posts: {
                deliverableId: string;
                /** @enum {string} */
                platform: "youtube_video" | "youtube_short";
                itemCount: number;
                amount?: string;
                deadlineDays?: number;
                hold?: components["schemas"]["Hold"];
            }[];
            /** Format: email */
            brandEmail?: string;
            version?: number;
            link?: {
                url: string;
                expiresAt: string;
                expired: boolean;
            };
            notes?: components["schemas"]["Note"][];
        };
        Hold: {
            /** @enum {string} */
            state: "not_started" | "closed" | "declined" | "pending" | "unknown" | "held";
            reference?: string;
            deadline?: string;
        };
        DraftAccepted: {
            deliverableId: string;
            /** @enum {string} */
            state: "checking";
            run: number;
        };
        BrandSession: {
            dealId: string;
        };
        BrandDeal: {
            dealId: string;
            creatorName: string;
            brandName: string;
            /** @enum {string} */
            step: "waiting_for_brand" | "changes_requested" | "agreed";
            version: number;
            agreedAt?: string;
            paypalClientId?: string;
            posts: {
                deliverableId: string;
                /** @enum {string} */
                platform: "youtube_video" | "youtube_short";
                amount: string;
                deadlineDays: number;
                changed?: ("amount" | "deadline")[];
                hold: components["schemas"]["Hold"];
            }[];
            items: {
                id: string;
                deliverableId: string;
                name: string;
                briefLine?: number;
                addedByCreator: boolean;
                changed?: boolean;
            }[];
            brief: {
                number: number;
                text: string;
            }[];
            answers: {
                briefLine: number;
                /** @enum {string} */
                kind: "suggestion" | "own_words" | "left_out";
                text?: string;
            }[];
            notes: components["schemas"]["Note"][];
        };
        HoldStart: {
            orderId: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
