import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);
const API_BASE = "/api";

const fetchJSON = async (url, options = {}, token) => {
    const headers = options.headers ? { ...options.headers } : {};
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || "Request failed");
    }
    return data;
};

const Section = ({ title, subtitle, children }) => html`
    <section className="rounded-xl border border-app bg-surface p-4 shadow-lg sm:p-6">
        <h2 className="text-base font-semibold text-primary sm:text-lg">${title}</h2>
        ${subtitle ? html`<p className="mt-1 text-xs text-secondary sm:text-sm">${subtitle}</p>` : null}
        <div className="mt-4">${children}</div>
    </section>
`;

const useLocalStorageState = (key, fallback) => {
    const [value, setValue] = useState(() => {
        const stored = localStorage.getItem(key);
        if (!stored) {
            return fallback;
        }
        try {
            return JSON.parse(stored);
        } catch (error) {
            return fallback;
        }
    });

    useEffect(() => {
        if (value === null || value === undefined) {
            localStorage.removeItem(key);
        } else {
            localStorage.setItem(key, JSON.stringify(value));
        }
    }, [key, value]);

    return [value, setValue];
};

const ClauseCard = ({
    clause,
    isLawyer,
    allowClientComments,
    onStatusUpdate,
    onAnnotate,
    token
}) => {
    const [commentText, setCommentText] = useState("");
    const [comments, setComments] = useState([]);
    const [commentStatus, setCommentStatus] = useState("");

    useEffect(() => {
        if (!token) {
            return;
        }
        fetchJSON(`${API_BASE}/clauses/${clause._id}/comments`, {}, token)
            .then(setComments)
            .catch(error => setCommentStatus(error.message));
    }, [clause._id, token]);

    const statusColor =
        clause.status === "AGREED"
            ? "status-agreed"
            : clause.status === "DISPUTED"
            ? "status-disputed"
            : "status-pending";

    return html`
        <div className="rounded-lg border border-app bg-app p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-primary">Clause ${clause.index + 1}</p>
                <div className="flex flex-wrap items-center gap-2">
                    ${clause.isChanged
                        ? html`<span className="rounded-full status-info px-2 py-1 text-[10px]">
                              Changed
                          </span>`
                        : null}
                    <span className=${`rounded-full px-3 py-1 text-xs ${statusColor}`}>${clause.status}</span>
                </div>
            </div>
            <p className="mt-2 text-xs text-secondary sm:text-sm">${clause.text}</p>
            <div className="mt-3 text-xs text-muted">
                Reviewer: ${clause.reviewer?.name || "Unassigned"} ${clause.reviewer?.organization || ""}
            </div>

            ${isLawyer
                ? html`
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <select
                              className="rounded-md border border-app input-field px-2 py-2 text-xs"
                              value=${clause.status}
                              onChange=${event =>
                                  onStatusUpdate(clause._id, {
                                      status: event.target.value,
                                      disputeReason: clause.disputeReason || ""
                                  })}
                          >
                              ${["AGREED", "PENDING", "DISPUTED"].map(
                                  status => html`<option value=${status}>${status}</option>`
                              )}
                          </select>
                          <input
                              className="rounded-md border border-app input-field px-2 py-2 text-xs"
                              value=${clause.disputeReason || ""}
                              placeholder="Dispute reason (required if disputed)"
                              onChange=${event =>
                                  onStatusUpdate(clause._id, {
                                      status: clause.status,
                                      disputeReason: event.target.value
                                  })}
                          />
                          <button
                              className="w-full rounded-md btn-primary px-3 py-2 text-xs font-semibold transition sm:col-span-2"
                              onClick=${() =>
                                  onStatusUpdate(clause._id, {
                                      status: clause.status,
                                      disputeReason: clause.disputeReason || "",
                                      commit: true
                                  })}
                          >
                              Update status
                          </button>
                          <button
                              className="w-full rounded-md border border-app px-3 py-2 text-xs text-secondary transition hover:bg-surface sm:col-span-2"
                              onClick=${() => onAnnotate(clause._id)}
                          >
                              Annotate in PDF
                          </button>
                      </div>
                  `
                : null}

            ${(isLawyer || allowClientComments) &&
            html`
                <div className="mt-4 grid gap-3">
                    <textarea
                        className="h-20 rounded-md border border-app input-field px-2 py-2 text-xs"
                        placeholder="Add a clause comment (audit logged)"
                        value=${commentText}
                        onChange=${event => setCommentText(event.target.value)}
                    ></textarea>
                    <button
                        className="w-full rounded-md btn-primary px-3 py-2 text-xs font-semibold transition sm:w-auto"
                        onClick=${async () => {
                            if (!commentText.trim()) {
                                return;
                            }
                            try {
                                const comment = await fetchJSON(
                                    `${API_BASE}/clauses/${clause._id}/comments`,
                                    {
                                        method: "POST",
                                        body: JSON.stringify({ text: commentText.trim() })
                                    },
                                    token
                                );
                                setComments(prev => [...prev, comment]);
                                setCommentText("");
                                setCommentStatus("");
                            } catch (error) {
                                setCommentStatus(error.message);
                            }
                        }}
                    >
                        Add comment
                    </button>
                    <div className="space-y-2 text-xs text-secondary">
                        ${commentStatus
                            ? html`<p className="text-[color:var(--ac-danger)]">${commentStatus}</p>`
                            : null}
                        ${comments.length === 0
                            ? html`<p className="text-muted">No comments yet.</p>`
                            : comments.map(
                                  comment =>
                                      html`<p className="rounded-md border border-app bg-app px-2 py-1">
                                          ${comment.text}
                                      </p>`
                              )}
                    </div>
                </div>
            `}
        </div>
    `;
};

const CaseCard = ({ caseFile, isLawyer, onUpdateAssignments }) => {
    const [lawyerIds, setLawyerIds] = useState("");
    const [clientIds, setClientIds] = useState("");
    const [governmentIds, setGovernmentIds] = useState("");
    const [documentIds, setDocumentIds] = useState("");

    const memberCount =
        caseFile.members.lawyers.length +
        caseFile.members.clients.length +
        caseFile.members.government.length;

    return html`
        <div className="rounded-md border border-app bg-app p-3">
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-primary">${caseFile.title}</p>
                <span className="text-[10px] text-muted">${caseFile.status}</span>
            </div>
            <p className="mt-1 text-xs text-muted">${caseFile.description || "No description"}</p>
            <p className="mt-2 text-xs text-muted">Members: ${memberCount}</p>
            <p className="text-xs text-muted">Documents: ${caseFile.documents.length}</p>
            ${isLawyer
                ? html`
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <input
                              className="rounded-md border border-app input-field px-2 py-1 text-xs"
                              placeholder="Lawyer IDs"
                              value=${lawyerIds}
                              onChange=${event => setLawyerIds(event.target.value)}
                          />
                          <input
                              className="rounded-md border border-app input-field px-2 py-1 text-xs"
                              placeholder="Client IDs"
                              value=${clientIds}
                              onChange=${event => setClientIds(event.target.value)}
                          />
                          <input
                              className="rounded-md border border-app input-field px-2 py-1 text-xs"
                              placeholder="Government IDs"
                              value=${governmentIds}
                              onChange=${event => setGovernmentIds(event.target.value)}
                          />
                          <input
                              className="rounded-md border border-app input-field px-2 py-1 text-xs"
                              placeholder="Document IDs"
                              value=${documentIds}
                              onChange=${event => setDocumentIds(event.target.value)}
                          />
                          <button
                              className="sm:col-span-2 w-full rounded-md btn-primary px-3 py-2 text-xs font-semibold transition sm:w-auto"
                              onClick=${() =>
                                  onUpdateAssignments(caseFile._id, {
                                      lawyerIds,
                                      clientIds,
                                      governmentIds,
                                      documentIds
                                  })}
                          >
                              Update assignments
                          </button>
                      </div>
                  `
                : null}
        </div>
    `;
};

const App = () => {
    const [token, setToken] = useLocalStorageState("attorneycare_token", null);
    const [user, setUser] = useLocalStorageState("attorneycare_user", null);
    const [signupStatus, setSignupStatus] = useState("");
    const [loginStatus, setLoginStatus] = useState("");
    const [uploadStatus, setUploadStatus] = useState("");
    const [clausesStatus, setClausesStatus] = useState("");
    const [documents, setDocuments] = useState([]);
    const [selectedDocumentId, setSelectedDocumentId] = useState(null);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [clauses, setClauses] = useState([]);
    const [versions, setVersions] = useState([]);
    const [compareStatus, setCompareStatus] = useState("");
    const [compareIndexes, setCompareIndexes] = useState(new Set());
    const [annotations, setAnnotations] = useState([]);
    const [annotationMode, setAnnotationMode] = useState(false);
    const [activeClauseId, setActiveClauseId] = useState(null);
    const [annotationHint, setAnnotationHint] = useState("Select a clause, then draw on the PDF.");
    const [previewBox, setPreviewBox] = useState(null);
    const [clausesInput, setClausesInput] = useState("");
    const [libraryQuery, setLibraryQuery] = useState("");
    const [libraryArticles, setLibraryArticles] = useState([]);
    const [libraryStatus, setLibraryStatus] = useState("");
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditStatus, setAuditStatus] = useState("");
    const [caseStatus, setCaseStatus] = useState("");
    const [cases, setCases] = useState([]);
    const [loginForm, setLoginForm] = useState({
        email: "",
        password: ""
    });

    const pdfCanvasRef = useRef(null);
    const pdfContainerRef = useRef(null);
    const chartCanvasRef = useRef(null);
    const chartRef = useRef(null);
    const dragStartRef = useRef(null);

    const isLawyer = user?.role === "lawyer";
    const allowClientComments =
        user?.role === "client" && selectedDocument?.clientCommentingAllowed;

    const milestones = useMemo(
        () => [
            { label: "Document intake", date: "2026-01-05", status: "done" },
            { label: "Clause review opened", date: "2026-01-08", status: "done" },
            { label: "Dispute resolution", date: "2026-01-18", status: "pending" },
            { label: "Government audit review", date: "2026-01-26", status: "locked" },
            { label: "Final submission", date: "2026-02-02", status: "locked" }
        ],
        []
    );

    const setAuthState = (newToken, newUser) => {
        setToken(newToken);
        setUser(newUser);
    };

    const loadDocuments = async () => {
        if (!token) {
            setDocuments([]);
            return;
        }
        try {
            const response = await fetchJSON(`${API_BASE}/documents`, {}, token);
            setDocuments(response);
        } catch (error) {
            setDocuments([]);
        }
    };

    const loadClauses = async documentId => {
        if (!documentId || !token) {
            setClauses([]);
            return;
        }
        try {
            const response = await fetchJSON(`${API_BASE}/documents/${documentId}/clauses`, {}, token);
            const enriched = response.map(clause => ({
                ...clause,
                isChanged: compareIndexes.has(clause.index)
            }));
            setClauses(enriched);
        } catch (error) {
            setClauses([]);
        }
    };

    const loadVersions = async documentId => {
        if (!documentId || !token) {
            setVersions([]);
            return;
        }
        try {
            const response = await fetchJSON(`${API_BASE}/documents/${documentId}/versions`, {}, token);
            setVersions(response.versions || []);
        } catch (error) {
            setVersions([]);
        }
    };

    const loadAnnotations = async documentId => {
        if (!documentId || !token) {
            setAnnotations([]);
            return;
        }
        try {
            const response = await fetchJSON(
                `${API_BASE}/documents/${documentId}/annotations`,
                {},
                token
            );
            setAnnotations(response);
        } catch (error) {
            setAnnotations([]);
        }
    };

    const loadLibrary = async () => {
        if (!token) {
            setLibraryArticles([]);
            setLibraryStatus("Sign in to browse library.");
            return;
        }
        const url = libraryQuery
            ? `${API_BASE}/library/articles?q=${encodeURIComponent(libraryQuery)}`
            : `${API_BASE}/library/articles`;
        try {
            const response = await fetchJSON(url, {}, token);
            setLibraryArticles(response);
            setLibraryStatus("");
        } catch (error) {
            setLibraryArticles([]);
            setLibraryStatus(error.message);
        }
    };

    const loadAuditLogs = async () => {
        if (!token || user?.role !== "government") {
            setAuditLogs([]);
            setAuditStatus("Audit logs are visible to government officials only.");
            return;
        }
        try {
            const response = await fetchJSON(`${API_BASE}/audit/logs`, {}, token);
            setAuditLogs(response.logs || []);
            setAuditStatus(response.logs?.length ? "" : "No audit entries available.");
        } catch (error) {
            setAuditLogs([]);
            setAuditStatus(error.message);
        }
    };

    const loadCases = async () => {
        if (!token) {
            setCases([]);
            return;
        }
        try {
            const response = await fetchJSON(`${API_BASE}/cases`, {}, token);
            setCases(response);
        } catch (error) {
            setCases([]);
        }
    };

    useEffect(() => {
        loadDocuments();
        loadLibrary();
        loadAuditLogs();
        loadCases();
    }, [token]);

    useEffect(() => {
        if (!selectedDocumentId || !selectedDocument) {
            setClauses([]);
            return;
        }
        loadClauses(selectedDocumentId);
        loadVersions(selectedDocumentId);
        loadAnnotations(selectedDocumentId);
    }, [selectedDocumentId, selectedDocument, compareIndexes]);

    useEffect(() => {
        if (!selectedDocument || !token || !pdfCanvasRef.current) {
            return;
        }
        const renderPdf = async () => {
            if (!selectedDocument.mimeType.includes("pdf")) {
                const context = pdfCanvasRef.current.getContext("2d");
                context.clearRect(0, 0, pdfCanvasRef.current.width, pdfCanvasRef.current.height);
                context.font = "14px sans-serif";
                context.fillStyle = "#6b7280";
                context.fillText("PDF preview available for PDF documents only.", 10, 20);
                return;
            }

            if (!window.pdfjsLib) {
                return;
            }
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            const loadingTask = window.pdfjsLib.getDocument({
                url: `${API_BASE}/documents/${selectedDocument._id}/file`,
                httpHeaders: { Authorization: `Bearer ${token}` }
            });
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.2 });
            const canvas = pdfCanvasRef.current;
            const context = canvas.getContext("2d");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: context, viewport }).promise;
        };
        renderPdf().catch(() => null);
    }, [selectedDocument, token]);

    useEffect(() => {
        if (!chartCanvasRef.current) {
            return;
        }
        const completed = milestones.filter(step => step.status === "done").length;
        const pending = milestones.filter(step => step.status === "pending").length;
        const locked = milestones.filter(step => step.status === "locked").length;

        if (chartRef.current) {
            chartRef.current.destroy();
        }
        chartRef.current = new Chart(chartCanvasRef.current, {
            type: "doughnut",
            data: {
                labels: ["Completed", "Pending", "Locked"],
                datasets: [
                    {
                        data: [completed, pending, locked],
                        backgroundColor: ["#22c55e", "#facc15", "#4b5563"],
                        borderWidth: 0
                    }
                ]
            },
            options: {
                plugins: {
                    legend: {
                        labels: { color: "#a1a1aa" }
                    }
                }
            }
        });

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
            }
        };
    }, [milestones]);

    useEffect(() => {
        setAnnotationHint(
            annotationMode
                ? activeClauseId
                    ? "Draw a rectangle on the PDF to highlight the clause."
                    : "Select a clause, then draw on the PDF."
                : "Annotation mode off."
        );
    }, [annotationMode, activeClauseId]);

    const handleSignup = async event => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const payload = Object.fromEntries(formData.entries());
        try {
            const response = await fetchJSON(`${API_BASE}/auth/signup`, {
                method: "POST",
                body: JSON.stringify(payload)
            });
            setSignupStatus(response.message || "Signup successful");
            if (response.token) {
                setAuthState(response.token, response.user);
                return;
            }
        } catch (error) {
            setSignupStatus(error.message);
        }
    };

    const handleLogin = async event => {
        event.preventDefault();
        const payload = {
            email: loginForm.email,
            password: loginForm.password
        };
        try {
            const response = await fetchJSON(`${API_BASE}/auth/login`, {
                method: "POST",
                body: JSON.stringify(payload)
            });
            setAuthState(response.token, response.user);
            setLoginStatus("Logged in successfully.");
        } catch (error) {
            setLoginStatus(error.message);
        }
    };

    const handleUpload = async event => {
        event.preventDefault();
        if (!token) {
            setUploadStatus("Sign in to upload documents.");
            return;
        }
        const formData = new FormData(event.currentTarget);
        try {
            const response = await fetchJSON(
                `${API_BASE}/documents`,
                { method: "POST", body: formData },
                token
            );
            setUploadStatus(`Uploaded "${response.title}" successfully.`);
            await loadDocuments();
        } catch (error) {
            setUploadStatus(error.message);
        }
    };

    const handleSplitClauses = async () => {
        if (!selectedDocumentId) {
            setClausesStatus("Select a document first.");
            return;
        }
        if (!isLawyer) {
            setClausesStatus("Only lawyers can split clauses.");
            return;
        }
        const lines = clausesInput
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean);
        if (!lines.length) {
            setClausesStatus("Provide at least one clause.");
            return;
        }
        try {
            await fetchJSON(
                `${API_BASE}/documents/${selectedDocumentId}/clauses/split`,
                { method: "POST", body: JSON.stringify({ clauses: lines }) },
                token
            );
            setClausesStatus("Clauses saved successfully.");
            setClausesInput("");
            await loadClauses(selectedDocumentId);
        } catch (error) {
            setClausesStatus(error.message);
        }
    };

    const handleStatusUpdate = async (clauseId, update) => {
        if (!update.commit) {
            setClauses(prev =>
                prev.map(clause =>
                    clause._id === clauseId
                        ? { ...clause, status: update.status, disputeReason: update.disputeReason }
                        : clause
                )
            );
            return;
        }
        try {
            await fetchJSON(
                `${API_BASE}/clauses/${clauseId}/status`,
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        status: update.status,
                        disputeReason: update.disputeReason
                    })
                },
                token
            );
            await loadClauses(selectedDocumentId);
        } catch (error) {
            setClausesStatus(error.message);
        }
    };

    const handleCompare = async compareId => {
        if (!selectedDocumentId || !compareId) {
            setCompareStatus("Select a version to compare.");
            return;
        }
        try {
            const response = await fetchJSON(
                `${API_BASE}/documents/${selectedDocumentId}/compare/${compareId}`,
                {},
                token
            );
            setCompareIndexes(new Set(response.changedIndexes));
            setCompareStatus(`${response.changedIndexes.length} clause(s) differ.`);
        } catch (error) {
            setCompareStatus(error.message);
        }
    };

    const handleCaseCreate = async event => {
        event.preventDefault();
        if (!isLawyer) {
            setCaseStatus("Only lawyers can create cases.");
            return;
        }
        const formData = new FormData(event.currentTarget);
        const toList = value =>
            value
                ? value
                      .split(",")
                      .map(item => item.trim())
                      .filter(Boolean)
                : [];
        try {
            const response = await fetchJSON(
                `${API_BASE}/cases`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        title: formData.get("title"),
                        description: formData.get("description"),
                        lawyerIds: toList(formData.get("lawyerIds")),
                        clientIds: toList(formData.get("clientIds")),
                        governmentIds: toList(formData.get("governmentIds")),
                        documentIds: toList(formData.get("documentIds"))
                    })
                },
                token
            );
            setCaseStatus(`Created case "${response.title}".`);
            event.currentTarget.reset();
            await loadCases();
        } catch (error) {
            setCaseStatus(error.message);
        }
    };

    const handleAssignmentsUpdate = async (caseId, payload) => {
        const toList = value =>
            value
                .split(",")
                .map(item => item.trim())
                .filter(Boolean);
        try {
            await fetchJSON(
                `${API_BASE}/cases/${caseId}/assign`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        lawyerIds: toList(payload.lawyerIds),
                        clientIds: toList(payload.clientIds),
                        governmentIds: toList(payload.governmentIds),
                        documentIds: toList(payload.documentIds)
                    })
                },
                token
            );
            await loadCases();
        } catch (error) {
            setCaseStatus(error.message);
        }
    };

    const handleBookmark = async id => {
        try {
            await fetchJSON(`${API_BASE}/library/bookmarks/${id}`, { method: "POST" }, token);
            await loadLibrary();
        } catch (error) {
            setLibraryStatus(error.message);
        }
    };

    const handleAnnotate = clauseId => {
        setActiveClauseId(clauseId);
        setAnnotationMode(true);
    };

    const getNormalizedPoint = event => {
        if (!pdfCanvasRef.current) {
            return null;
        }
        const rect = pdfCanvasRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
        const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height));
        return { x: x / rect.width, y: y / rect.height };
    };

    const handleCanvasMouseDown = event => {
        if (!annotationMode || !activeClauseId) {
            return;
        }
        const start = getNormalizedPoint(event);
        dragStartRef.current = start;
        setPreviewBox({ x: start.x, y: start.y, width: 0, height: 0 });
    };

    const handleCanvasMouseMove = event => {
        if (!dragStartRef.current) {
            return;
        }
        const current = getNormalizedPoint(event);
        const left = Math.min(dragStartRef.current.x, current.x);
        const top = Math.min(dragStartRef.current.y, current.y);
        const width = Math.abs(dragStartRef.current.x - current.x);
        const height = Math.abs(dragStartRef.current.y - current.y);
        setPreviewBox({ x: left, y: top, width, height });
    };

    const finalizeAnnotation = async event => {
        if (!dragStartRef.current) {
            return;
        }
        const endPoint = getNormalizedPoint(event);
        const left = Math.min(dragStartRef.current.x, endPoint.x);
        const top = Math.min(dragStartRef.current.y, endPoint.y);
        const width = Math.abs(dragStartRef.current.x - endPoint.x);
        const height = Math.abs(dragStartRef.current.y - endPoint.y);
        dragStartRef.current = null;
        setPreviewBox(null);

        if (width < 0.01 || height < 0.01) {
            return;
        }

        try {
            await fetchJSON(
                `${API_BASE}/documents/${selectedDocumentId}/annotations`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        clauseId: activeClauseId,
                        page: 1,
                        x: left,
                        y: top,
                        width,
                        height
                    })
                },
                token
            );
            await loadAnnotations(selectedDocumentId);
            setAnnotationMode(false);
            setActiveClauseId(null);
        } catch (error) {
            setClausesStatus(error.message);
        }
    };

    const renderDocumentList = documents.length
        ? documents.map(doc => html`
              <button
                  key=${doc._id}
                  className=${`text-left rounded-md border border-app bg-app p-3 text-sm transition hover:border-[color:var(--ac-accent-hover)] ${
                      selectedDocumentId === doc._id ? "border-[color:var(--ac-accent)]" : ""
                  }`}
                  onClick=${() => {
                      setSelectedDocumentId(doc._id);
                      setSelectedDocument(doc);
                      setCompareIndexes(new Set());
                      setActiveClauseId(null);
                      setAnnotationMode(false);
                  }}
              >
                  <div className="flex items-center justify-between">
                      <span className="font-semibold text-primary">${doc.title}</span>
                      <span className="text-xs text-muted">v${doc.version}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">${doc.mimeType}</p>
              </button>
          `)
        : html`<p className="text-sm text-muted">No documents assigned yet.</p>`;

    const versionsOptions = versions.filter(version => version._id !== selectedDocumentId);

    const handleLogout = () => {
        setAuthState(null, null);
        setDocuments([]);
        setCases([]);
        setClauses([]);
        setVersions([]);
        setAnnotations([]);
        setAuditLogs([]);
        setLibraryArticles([]);
        setCompareIndexes(new Set());
        setSelectedDocument(null);
        setSelectedDocumentId(null);
    };

    return html`
        <div className="min-h-screen">
            <header className="border-b border-app bg-surface backdrop-blur">
                <div className="mx-auto flex max-w-6xl flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                    <div>
                        <p className="text-lg font-semibold tracking-wide text-primary sm:text-xl">AttorneyCare</p>
                        <p className="text-xs text-secondary sm:text-sm">
                            Transparent legal collaboration for audits and courts
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 text-xs text-secondary sm:items-end sm:text-sm">
                        <span className="truncate max-w-[200px] sm:max-w-none">
                            ${user ? `${user.name} • ${user.role}` : "Not signed in"}
                        </span>
                        ${user
                            ? html`
                                  <button
                                      className="w-full rounded-md btn-outline px-3 py-1 text-xs transition sm:w-auto"
                                      onClick=${handleLogout}
                                  >
                                      Sign out
                                  </button>
                              `
                            : null}
                    </div>
                </div>
            </header>

            <main className="mx-auto flex max-w-6xl flex-col gap-6 px-3 py-5 sm:gap-10 sm:px-4 sm:py-6">
                

                ${Section({
                    title: "Secure Document Management",
                    subtitle: "Upload PDFs or DOCX files, manage versions, and enforce role-based access.",
                    children: html`
                        <div className="grid gap-6 lg:grid-cols-1">
                            <div className="rounded-lg border border-app bg-surface p-4 sm:p-5">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm font-semibold text-secondary">Accessible documents</p>
                                    <button
                                        className="w-full rounded-md border border-app px-3 py-1 text-xs text-secondary transition hover:bg-surface sm:w-auto"
                                        onClick=${loadDocuments}
                                    >
                                        Refresh
                                    </button>
                                </div>
                                <div className="mt-3 space-y-2 text-xs text-secondary sm:text-sm">${renderDocumentList}</div>
                                <div className="mt-4 border-t border-app pt-4">
                                    <p className="text-sm font-semibold text-secondary">Version history</p>
                                    <div className="mt-2 space-y-2 text-xs text-secondary">
                                        ${versions.length
                                            ? versions.map(
                                                  version => html`
                                                      <div className="rounded-md border border-app bg-app px-2 py-2">
                                                          <div className="flex items-center justify-between">
                                                              <span className="text-xs text-primary">
                                                                  ${version.title}
                                                              </span>
                                                              <span className="text-[10px] text-muted">
                                                                  v${version.version}
                                                              </span>
                                                          </div>
                                                          <p className="text-[10px] text-muted">
                                                              ${new Date(version.createdAt).toLocaleString()}
                                                          </p>
                                                      </div>
                                                  `
                                              )
                                            : html`<p className="text-xs text-muted">Select a document.</p>`}
                                    </div>
                                    <div className="mt-3 flex flex-col gap-2">
                                        <select
                                            className="rounded-md border border-app input-field px-2 py-2 text-xs"
                                            onChange=${event => handleCompare(event.target.value)}
                                        >
                                            <option value="">Compare with selected version</option>
                                            ${versionsOptions.map(
                                                version =>
                                                    html`<option value=${version._id}>
                                                        v${version.version} (${version.title})
                                                    </option>`
                                            )}
                                        </select>
                                        <p className="text-xs text-secondary">${compareStatus}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                            <div className="rounded-lg border border-app bg-surface p-4 sm:p-5">
                                <p className="text-sm font-semibold text-secondary">PDF viewer</p>
                                <div className="mt-3 flex flex-col gap-2 text-xs text-secondary sm:flex-row sm:items-center">
                                    <button
                                        className="w-full rounded-md btn-primary px-3 py-2 text-xs font-semibold transition sm:w-auto sm:py-1"
                                        onClick=${() => setAnnotationMode(true)}
                                    >
                                        Start highlight
                                    </button>
                                    <button
                                        className="w-full rounded-md border border-app px-3 py-2 text-xs text-secondary transition hover:bg-surface sm:w-auto sm:py-1"
                                        onClick=${() => {
                                            setAnnotationMode(false);
                                            setActiveClauseId(null);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <span>${annotationHint}</span>
                                </div>
                                <div className="mt-3 rounded-md border border-app bg-app p-2 sm:p-3">
                                    <div
                                        className="relative w-full overflow-auto max-h-[60vh] sm:max-h-none"
                                        ref=${pdfContainerRef}
                                    >
                                        <canvas
                                            ref=${pdfCanvasRef}
                                            className="w-full"
                                            onMouseDown=${handleCanvasMouseDown}
                                            onMouseMove=${handleCanvasMouseMove}
                                            onMouseUp=${finalizeAnnotation}
                                            onMouseLeave=${finalizeAnnotation}
                                        ></canvas>
                                        <div className="pointer-events-none absolute inset-0">
                                            ${annotations.map(
                                                annotation => html`
                                                    <div
                                                        key=${annotation._id}
                                                        className="absolute rounded-sm"
                                                        style=${{
                                                            left: `${annotation.x * 100}%`,
                                                            top: `${annotation.y * 100}%`,
                                                            width: `${annotation.width * 100}%`,
                                                            height: `${annotation.height * 100}%`,
                                                            border: "1px solid var(--ac-accent)",
                                                            backgroundColor: "color-mix(in srgb, var(--ac-accent) 18%, transparent)"
                                                        }}
                                                    ></div>
                                                `
                                            )}
                                            ${previewBox
                                                ? html`
                                                      <div
                                                          className="absolute rounded-sm"
                                                          style=${{
                                                              left: `${previewBox.x * 100}%`,
                                                              top: `${previewBox.y * 100}%`,
                                                              width: `${previewBox.width * 100}%`,
                                                              height: `${previewBox.height * 100}%`,
                                                              border: "1px solid var(--ac-info)",
                                                              backgroundColor: "color-mix(in srgb, var(--ac-info) 18%, transparent)"
                                                          }}
                                                      ></div>
                                                  `
                                                : null}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-lg border border-app bg-surface p-4 sm:p-5">
                                <p className="text-sm font-semibold text-secondary">Clause ingestion</p>
                                <textarea
                                    className="mt-3 h-40 w-full rounded-md border border-app input-field px-3 py-2 text-sm"
                                    placeholder="Paste clauses, one per line"
                                    value=${clausesInput}
                                    onChange=${event => setClausesInput(event.target.value)}
                                ></textarea>
                                <button
                                    className="mt-3 w-full rounded-md btn-primary px-4 py-2 text-sm font-semibold transition"
                                    onClick=${handleSplitClauses}
                                >
                                    Save clauses
                                </button>
                                <p className="mt-2 text-xs text-secondary">${clausesStatus}</p>
                            </div>
                        </div>
                    `
                })}

                ${Section({
                    title: "Clause-wise Review",
                    subtitle: "Track agreement status, disputes, and comments with full reviewer identity.",
                    children: clauses.length
                        ? html`<div className="space-y-4">
                              ${clauses.map(
                                  clause =>
                                      html`
                                          <${ClauseCard}
                                              key=${clause._id}
                                              clause=${clause}
                                              isLawyer=${isLawyer}
                                              allowClientComments=${allowClientComments}
                                              onStatusUpdate=${handleStatusUpdate}
                                              onAnnotate=${handleAnnotate}
                                              token=${token}
                                          />
                                      `
                              )}
                          </div>`
                        : html`<p className="text-xs text-muted sm:text-sm">Select a document to review clauses.</p>`
                })}

                ${Section({
                    title: "Case Workspaces",
                    subtitle: "Organize matters with assigned lawyers, clients, officials, and documents.",
                    children: html`
                        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                            <form className="grid gap-3 rounded-lg border border-app bg-surface p-4 sm:p-5" onSubmit=${handleCaseCreate}>
                                <p className="text-sm font-semibold text-secondary">Create a case (lawyers only)</p>
                                <input className="rounded-md border border-app input-field px-3 py-2 text-sm" name="title" placeholder="Case title" required />
                                <textarea className="h-24 rounded-md border border-app input-field px-3 py-2 text-sm" name="description" placeholder="Short case description"></textarea>
                                <input className="rounded-md border border-app input-field px-3 py-2 text-xs" name="lawyerIds" placeholder="Lawyer IDs (comma-separated)" />
                                <input className="rounded-md border border-app input-field px-3 py-2 text-xs" name="clientIds" placeholder="Client IDs (comma-separated)" />
                                <input className="rounded-md border border-app input-field px-3 py-2 text-xs" name="governmentIds" placeholder="Government IDs (comma-separated)" />
                                <input className="rounded-md border border-app input-field px-3 py-2 text-xs" name="documentIds" placeholder="Document IDs (comma-separated)" />
                                <button className="w-full rounded-md btn-primary px-4 py-2 text-sm font-semibold transition sm:w-auto" type="submit">
                                    Create case
                                </button>
                                <p className="text-xs text-secondary">${caseStatus}</p>
                            </form>
                            <div className="rounded-lg border border-app bg-surface p-4 sm:p-5">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm font-semibold text-secondary">Assigned cases</p>
                                    <button
                                        className="w-full rounded-md border border-app px-3 py-1 text-xs text-secondary transition hover:bg-surface sm:w-auto"
                                        onClick=${loadCases}
                                    >
                                        Refresh
                                    </button>
                                </div>
                                <div className="mt-3 space-y-3 text-xs text-secondary sm:text-sm">
                                    ${cases.length
                                        ? cases.map(
                                              caseFile =>
                                                  html`
                                                      <${CaseCard}
                                                          key=${caseFile._id}
                                                          caseFile=${caseFile}
                                                          isLawyer=${isLawyer}
                                                          onUpdateAssignments=${handleAssignmentsUpdate}
                                                      />
                                                  `
                                          )
                                        : html`<p className="text-sm text-muted">No cases assigned.</p>`}
                                </div>
                            </div>
                        </div>
                    `
                })}

                ${Section({
                    title: "Timeline & Case Progress",
                    subtitle: "Clear milestones with locked future steps for non-lawyer clarity.",
                    children: html`
                        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                            <div className="rounded-lg border border-app bg-surface p-4 sm:p-5">
                                <canvas ref=${chartCanvasRef} height="200"></canvas>
                            </div>
                            <ul className="space-y-3 text-xs text-secondary sm:text-sm">
                                ${milestones.map(step => {
                                    const badge =
                                        step.status === "done"
                                            ? "status-agreed"
                                            : step.status === "pending"
                                            ? "status-pending"
                                            : "status-disabled";
                                    const statusLabel = step.status === "locked" ? "Locked" : step.status.toUpperCase();
                                    return html`
                                        <li className="rounded-md border border-app bg-app p-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-semibold text-primary">${step.label}</span>
                                                <span className=${`rounded-full px-3 py-1 text-xs ${badge}`}>
                                                    ${statusLabel}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-xs text-muted">${step.date}</p>
                                        </li>
                                    `;
                                })}
                            </ul>
                        </div>
                    `
                })}

                ${Section({
                    title: "Constitution & Legal Library",
                    subtitle: "Search authoritative articles and bookmark key references.",
                    children: html`
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                            <input
                                className="w-full rounded-md border border-app input-field px-3 py-2 text-sm"
                                placeholder="Search by article number, title, or topic"
                                value=${libraryQuery}
                                onChange=${event => setLibraryQuery(event.target.value)}
                            />
                            <button
                                className="w-full rounded-md btn-primary px-4 py-2 text-sm font-semibold transition lg:w-auto"
                                onClick=${loadLibrary}
                            >
                                Search
                            </button>
                        </div>
                        <div className="mt-4 space-y-3 text-sm text-secondary">
                            ${libraryStatus ? html`<p className="text-sm text-secondary">${libraryStatus}</p>` : null}
                            ${libraryArticles.map(
                                article => html`
                                    <div className="rounded-md border border-app bg-app p-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-primary">
                                                    ${article.articleNumber} • ${article.title}
                                                </p>
                                                <p className="text-xs text-muted">${article.section}</p>
                                            </div>
                                            <button
                                                className="text-xs text-[color:var(--ac-accent)] hover:text-[color:var(--ac-accent-hover)]"
                                                onClick=${() => handleBookmark(article._id)}
                                            >
                                                Bookmark
                                            </button>
                                        </div>
                                        <p className="mt-2 text-xs text-secondary">${article.content}</p>
                                    </div>
                                `
                            )}
                        </div>
                    `
                })}

                ${Section({
                    title: "Audit Trail (Government Access)",
                    subtitle: "Immutable log of critical actions for oversight and accountability.",
                    children: html`
                        <div className="overflow-auto rounded-lg border border-app">
                            <table className="responsive-table min-w-full text-xs sm:text-sm">
                                <thead className="bg-surface text-secondary">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Action</th>
                                        <th className="px-3 py-2 text-left">Actor</th>
                                        <th className="px-3 py-2 text-left">Entity</th>
                                        <th className="px-3 py-2 text-left">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[color:var(--ac-border)] text-secondary">
                                    ${auditLogs.map(
                                        log => html`
                                            <tr>
                                                <td className="px-3 py-2">${log.action}</td>
                                                <td className="px-3 py-2">${log.actor_id} (${log.actor_role})</td>
                                                <td className="px-3 py-2">${log.entity_type} ${log.entity_id || ""}</td>
                                                <td className="px-3 py-2">${new Date(log.created_at).toLocaleString()}</td>
                                            </tr>
                                        `
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-2 text-xs text-secondary">${auditStatus}</p>
                    `
                })}
            </main>
        </div>
    `;
};

const root = createRoot(document.getElementById("root"));
root.render(html`<${App} />`);
