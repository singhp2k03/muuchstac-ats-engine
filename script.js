let globalCandidatesData = [];

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 🌙 DARK MODE LOGIC ☀️ ---
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const body = document.body;

    const sunIcon = `<circle cx="12" cy="12" r="5" fill="currentColor"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2v2m0 16v2M4.929 4.929l1.414 1.414m11.314 11.314l1.414 1.414M2 12h2m16 0h2M6.343 17.657l-1.414 1.414M17.657 6.343l1.414-1.414"/>`;
    const moonIcon = `<path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" fill="currentColor"/>`;

    if (localStorage.getItem('theme') === 'dark') {
        body.classList.add('dark-mode');
        if (themeIcon) themeIcon.innerHTML = moonIcon;
    } else {
        if (themeIcon) themeIcon.innerHTML = sunIcon;
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            if (body.classList.contains('dark-mode')) {
                localStorage.setItem('theme', 'dark');
                themeIcon.innerHTML = moonIcon;
            } else {
                localStorage.setItem('theme', 'light');
                themeIcon.innerHTML = sunIcon;
            }
        });
    }

    // --- 📚 JOB DESCRIPTION LIBRARY ---
    const jdInput = document.getElementById('job_description');
    const jdSelector = document.getElementById('jd_selector');
    const saveJDBtn = document.getElementById('saveJDBtn');
    const jdSavePanel = document.getElementById('jd_save_panel');
    const jdTitleInput = document.getElementById('jd_title');
    const confirmSaveJDBtn = document.getElementById('confirmSaveJDBtn');
    const cancelSaveJDBtn = document.getElementById('cancelSaveJDBtn');

    // Load saved JDs from LocalStorage on page load
    function loadJDLibrary() {
        const library = JSON.parse(localStorage.getItem('jd_library')) || {};
        
        // Reset dropdown (keep the default option)
        jdSelector.innerHTML = '<option value="">-- Load Saved JD --</option>';
        
        // Populate dropdown with saved JDs
        for (const title in library) {
            const option = document.createElement('option');
            option.value = title;
            option.textContent = title;
            jdSelector.appendChild(option);
        }
    }

    if (jdInput && jdSelector) {
        loadJDLibrary();

        // When a user selects a JD from the dropdown, fill the text area
        jdSelector.addEventListener('change', (e) => {
            const selectedTitle = e.target.value;
            if (selectedTitle) {
                const library = JSON.parse(localStorage.getItem('jd_library')) || {};
                jdInput.value = library[selectedTitle] || "";
            } else {
                jdInput.value = ""; // Clear if they select the default option
            }
        });

        // Show the save panel when "Save JD" is clicked
        saveJDBtn.addEventListener('click', () => {
            if (!jdInput.value.trim()) {
                if(window.showToast) window.showToast("Please paste a Job Description first before saving!", "error");
                else alert("Please paste a Job Description first before saving!");
                return;
            }
            jdSavePanel.classList.remove('hidden');
            jdTitleInput.focus();
        });

        // Hide the save panel on Cancel
        cancelSaveJDBtn.addEventListener('click', () => {
            jdSavePanel.classList.add('hidden');
            jdTitleInput.value = "";
        });

        // Save the JD to LocalStorage
        confirmSaveJDBtn.addEventListener('click', () => {
            const title = jdTitleInput.value.trim();
            const content = jdInput.value.trim();

            if (!title) {
                if(window.showToast) window.showToast("Please enter a title for this Job Description.", "error");
                else alert("Please enter a title for this Job Description.");
                return;
            }

            // Fetch existing library, add new entry, and save back
            const library = JSON.parse(localStorage.getItem('jd_library')) || {};
            library[title] = content;
            localStorage.setItem('jd_library', JSON.stringify(library));

            // Reset UI and reload dropdown
            jdSavePanel.classList.add('hidden');
            jdTitleInput.value = "";
            loadJDLibrary();
            
            // Auto-select the newly saved JD
            jdSelector.value = title;
            if(window.showToast) window.showToast(`"${title}" saved successfully!`, "success");
            else alert(`"${title}" saved successfully!`);
        });
    }

    // --- Modal Logic ---
    const modal = document.getElementById('candidateModal');
    const closeModal = document.getElementById('closeModal');
    if (closeModal) closeModal.onclick = () => modal.classList.add('hidden');
    window.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };

    // --- Drag & Drop Logic ---
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('files');
    const dropZoneText = document.getElementById('dropZoneText');

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                updateFileText(fileInput.files.length);
            }
        });

        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) updateFileText(fileInput.files.length);
        });
    }

    function updateFileText(count) {
        if (dropZoneText && dropZone) {
            dropZoneText.innerHTML = `
                <div class="upload-success-container">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <strong>${count} File(s) Ready to Analyze</strong>
                </div>
            `;
            
            dropZone.classList.add('has-files'); 
            dropZone.style.backgroundColor = 'var(--bg-color)';
            dropZone.style.borderColor = 'var(--success)';
            dropZone.style.color = 'var(--success)'; 
        }
    }

    // --- 🤖 AUTO-EXTRACT JD REQUIREMENTS ---
    const extractJdBtn = document.getElementById('extractJdBtn');
    const extractBtnText = document.getElementById('extractBtnText');
    
    if (extractJdBtn) {
        extractJdBtn.addEventListener('click', async () => {
            const jdText = jdInput.value.trim();
            if (!jdText) {
                if(window.showToast) window.showToast("Please paste a Job Description first!", "error");
                else alert("Please paste a Job Description first!");
                return;
            }

            // UI Loading State
            extractJdBtn.disabled = true;
            extractBtnText.innerHTML = "Extracting Requirements...";
            extractJdBtn.style.opacity = "0.7";

            const formData = new FormData();
            formData.append('job_description', jdText);
            
            // Hardcode the provider to 'gemini' since the UI element was removed to keep it simple for HR
            formData.append('ai_provider', 'gemini');

            try {
                const response = await fetch('http://127.0.0.1:8000/extract-jd-params/', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new Error("Failed to extract params");
                
                const data = await response.json();

                // Auto-fill the form boxes with the AI's findings!
                if (document.getElementById('min_experience_years')) document.getElementById('min_experience_years').value = data.min_experience_years || 0;
                if (document.getElementById('required_skills')) document.getElementById('required_skills').value = data.required_skills || "";
                if (document.getElementById('required_education')) document.getElementById('required_education').value = data.required_education || "";
                if (document.getElementById('target_location') && data.target_location) document.getElementById('target_location').value = data.target_location;

                if(window.showToast) window.showToast("Requirements extracted successfully! You can edit them below.", "success");

                // Add a cool brief highlight effect to show they were updated
                const inputsToHighlight = ['min_experience_years', 'required_skills', 'required_education', 'target_location'];
                inputsToHighlight.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        el.style.transition = "box-shadow 0.3s";
                        el.style.boxShadow = "0 0 0 3px rgba(16, 185, 129, 0.4)"; // Green glow
                        setTimeout(() => el.style.boxShadow = "none", 1500);
                    }
                });

            } catch (error) {
                console.error(error);
                if(window.showToast) window.showToast("Failed to auto-extract. You can enter them manually.", "error");
                else alert("Failed to auto-extract. You can enter them manually.");
            } finally {
                // Reset UI
                extractJdBtn.disabled = false;
                extractBtnText.innerHTML = "Auto-Extract Requirements from JD";
                extractJdBtn.style.opacity = "1";
            }
        });
    }

    // --- Form Submission ---
    const form = document.getElementById('atsForm');
    if (form) {
        form.addEventListener('submit', async function(event) {
            event.preventDefault();

            if (!fileInput || fileInput.files.length === 0) {
                if(window.showToast) window.showToast("Please drag and drop at least one resume!", "error");
                else alert("Please drag and drop at least one resume!");
                return;
            }

            const submitBtn = document.getElementById('submitBtn');
            const loadingDiv = document.getElementById('loading');
            const resultsSection = document.getElementById('resultsSection');
            const resultsBody = document.getElementById('resultsBody');

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<svg class="btn-spinner" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align: sub; margin-right: 8px;"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> Processing Resumes (Takes ~20-30 secs)...';
            }
            if (loadingDiv) loadingDiv.classList.remove('hidden');
            if (resultsSection) resultsSection.classList.add('hidden');
            if (resultsBody) resultsBody.innerHTML = ''; 

            const formData = new FormData();

            const getVal = (id) => {
                const el = document.getElementById(id);
                return el ? el.value : '';
            };
            const getCheck = (id) => {
                const el = document.getElementById(id);
                return el ? (el.checked ? 'true' : 'false') : 'false';
            };

            formData.append('job_description', getVal('job_description'));
            formData.append('min_experience_years', getVal('min_experience_years') || "0");
            formData.append('target_location', getVal('target_location'));
            formData.append('passing_score', getVal('passing_score') || "60");
            
            formData.append('mandatory_experience', getCheck('mandatory_experience'));
            formData.append('mandatory_location', getCheck('mandatory_location'));
            
            formData.append('required_skills', getVal('required_skills'));
            formData.append('required_education', getVal('required_education'));
            formData.append('mandatory_skills', getCheck('mandatory_skills'));
            formData.append('mandatory_education', getCheck('mandatory_education'));
            
            formData.append('shortlist_top_n', 0);

            // Hardcode the provider to 'gemini' silently in the background
            formData.append('ai_provider', 'gemini');

            for (let i = 0; i < fileInput.files.length; i++) {
                formData.append('files', fileInput.files[i]);
            }

            try {
                const response = await fetch('http://127.0.0.1:8000/analyze-batch-parallel/', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Server Error: ${errorText}`);
                }

                const data = await response.json();
                globalCandidatesData = data; 

                let qualifiedCount = 0;
                let rejectedCount = 0;

                const svgEmail = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:4px; vertical-align:text-bottom;"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>`;
                const svgPhone = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:4px; vertical-align:text-bottom;"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>`;
                const svgLocation = `<svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:4px; vertical-align:text-bottom;"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>`;

                if (data.length === 0) {
                    if (resultsBody) resultsBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No results returned.</td></tr>';
                } else {
                    data.forEach((candidate, index) => {
                        if (candidate.is_qualified) qualifiedCount++; else rejectedCount++;

                        const badgeClass = candidate.is_qualified ? 'status-qualified' : 'status-rejected';
                        const iconSvg = candidate.is_qualified 
                            ? `<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style="margin-right: 4px;"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>`
                            : `<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style="margin-right: 4px;"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>`;
                        const statusText = candidate.is_qualified ? 'Qualified' : 'Rejected';

                        let locColor = 'var(--text-muted)';
                        if(candidate.location_relevancy === 'High') locColor = 'var(--success)';
                        else if(candidate.location_relevancy === 'Medium') locColor = '#f59e0b'; 
                        else if(candidate.location_relevancy === 'Low' || candidate.location_relevancy === 'Relocation') locColor = 'var(--danger)';

                        const tr = document.createElement('tr');
                        
                        tr.innerHTML = `
                            <td>
                                <div class="candidate-name">${candidate.candidate_name || 'Unknown Candidate'}</div>
                                <div class="candidate-meta">${svgEmail} ${candidate.contact_email !== 'Not found' ? candidate.contact_email : 'N/A'}</div>
                                <div class="candidate-meta">${svgPhone} ${candidate.contact_phone !== 'Not found' ? candidate.contact_phone : 'N/A'}</div>
                            </td>
                            <td>
                                <span class="status-badge ${badgeClass}">
                                    ${iconSvg} ${statusText}
                                </span>
                            </td>
                            <td><span class="total-score">${candidate.total_score}</span><span class="score-muted">/100</span></td>
                            
                            <td>
                                <strong>${candidate.experience_score}</strong><span class="score-muted">/40</span><br>
                                <span style="font-size: 11px; font-weight: 600; color: var(--primary); background: #eff6ff; border: 1px solid #bfdbfe; padding: 2px 6px; border-radius: 4px; margin-top: 4px; display: inline-block;">
                                    ${candidate.experience_years} Yrs
                                </span>
                            </td>
                            
                            <td><strong>${candidate.skills_score}</strong><span class="score-muted">/30</span></td>
                            <td><strong>${candidate.education_score}</strong><span class="score-muted">/30</span></td>
                            <td>
                                <strong style="color: ${locColor};">${candidate.location_relevancy}</strong><br>
                                <span class="candidate-meta" style="margin-top:6px;">${svgLocation} ${candidate.candidate_location}</span>
                            </td>
                            <td>
                                <button type="button" class="action-btn" onclick="openDashboard(${index})">View Details</button>
                            </td>
                        `;
                        if (resultsBody) resultsBody.appendChild(tr);
                    });
                }

                if (document.getElementById('statTotal')) document.getElementById('statTotal').innerText = data.length;
                if (document.getElementById('statQualified')) document.getElementById('statQualified').innerText = qualifiedCount;
                if (document.getElementById('statRejected')) document.getElementById('statRejected').innerText = rejectedCount;

                if (resultsSection) resultsSection.classList.remove('hidden');

            } catch (error) {
                console.error('API Error:', error);
                if(window.showToast) window.showToast('Something went wrong!\n\nError: ' + error.message, 'error');
                else alert('Something went wrong!\n\nError: ' + error.message);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align: middle; margin-right: 8px;"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg> Analyze Batch';
                }
                if (loadingDiv) loadingDiv.classList.add('hidden');
                
                if (dropZoneText) dropZoneText.innerHTML = `Drag & Drop resumes here or <strong>Click to browse</strong>`;
                if (dropZone) {
                    dropZone.classList.remove('has-files'); 
                    dropZone.style.backgroundColor = 'var(--bg-color)';
                    dropZone.style.borderColor = 'var(--border-color)';
                    dropZone.style.color = 'var(--text-muted)'; 
                }
                if (fileInput) fileInput.value = ""; 
            }
        });
    }
});

window.openDashboard = function(index) {
    const cand = globalCandidatesData[index];
    const modal = document.getElementById('candidateModal');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalBody) return;

    const statusText = cand.is_qualified ? '✅ Qualified' : '❌ Rejected';
    const statusColor = cand.is_qualified ? 'var(--success)' : 'var(--danger)';

    let locColor = 'var(--text-muted)';
    if(cand.location_relevancy === 'High') locColor = 'var(--success)';
    else if(cand.location_relevancy === 'Medium') locColor = '#f59e0b';
    else if(cand.location_relevancy === 'Low' || cand.location_relevancy === 'Relocation') locColor = 'var(--danger)';

    const iconExp = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:8px; color:var(--primary); vertical-align:text-bottom;"><path stroke-linecap="round" stroke-linejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>`;
    const iconSkills = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:8px; color:var(--primary); vertical-align:text-bottom;"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>`;
    const iconEdu = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:8px; color:var(--primary); vertical-align:text-bottom;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"></path></svg>`;
    const iconLocation = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:8px; color:var(--text-muted); vertical-align:text-bottom;"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>`;
    const iconEmail = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:8px; color:var(--text-muted); vertical-align:text-bottom;"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>`;
    const iconPhone = `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="margin-right:8px; color:var(--text-muted); vertical-align:text-bottom;"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>`;
    const iconWarning = `<svg width="20" height="20" fill="none" stroke="var(--danger)" stroke-width="2" viewBox="0 0 24 24" style="margin-left:6px; vertical-align:text-bottom;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;

    const matchedSkillsHtml = (cand.skills && cand.skills.length > 0) 
        ? cand.skills.map(s => `<li>${s}</li>`).join('') 
        : '<li>No core skills found</li>';

    const missingReqsHtml = (cand.missing_requirements && cand.missing_requirements.length > 0)
        ? cand.missing_requirements.map(m => `<li>${m}</li>`).join('')
        : '<li>None!</li>';

    modalBody.innerHTML = `
        <div class="dashboard-header">
            <h2>${cand.candidate_name || cand.source_file}</h2>
            <h2 style="color: ${statusColor};">${statusText} (${cand.total_score}/100)</h2>
        </div>
        
        <div class="justification-box">
            <strong>AI Verdict:</strong> ${cand.score_justification}
        </div>

        <div class="dashboard-grid">
            <div class="dashboard-card">
                <h4>Pillar Breakdown</h4>
                
                <div style="margin-bottom: 12px;">
                    <p style="margin-bottom: 2px; display: flex; align-items: center;">
                        ${iconExp}<strong>Experience:</strong>&nbsp;${cand.experience_score}/40 
                        <span style="margin-left: 10px; background: #eff6ff; border: 1px solid #bfdbfe; color: var(--primary); padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                            Total: ${cand.experience_years} Years
                        </span>
                    </p>
                    <div style="margin-left: 26px; font-size: 0.85em; color: var(--text-muted);">${cand.experience_details || cand.experience_years + ' years detected'}</div>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <p style="margin-bottom: 2px;">${iconSkills}<strong>Skills:</strong> ${cand.skills_score}/30</p>
                    <div style="margin-left: 26px; font-size: 0.85em; color: var(--text-muted);">${cand.skills_details || 'Score based on matched keywords'}</div>
                </div>
                <div style="margin-bottom: 12px;">
                    <p style="margin-bottom: 2px;">${iconEdu}<strong>Education:</strong> ${cand.education_score}/30</p>

                    <div style="margin-left: 26px; font-size: 0.85em; color: var(--text-muted);">${cand.education_details || 'Score based on degree match'}</div>
                </div>
                <div>
                    <p style="margin-bottom: 2px;">${iconLocation}<strong>Location:</strong> <span style="color: ${locColor}; font-weight: bold;">${cand.location_relevancy}</span></p>
                    <div style="margin-left: 26px; font-size: 0.85em; color: var(--text-muted);">${cand.location_details || cand.candidate_location}</div>
                </div>
            </div>
            
            <div class="dashboard-card">
                <h4>Contact Info</h4>
                <p>${iconEmail}${cand.contact_email}</p>
                <p>${iconPhone}${cand.contact_phone}</p>
                <p>${iconLocation}${cand.candidate_location}</p>
            </div>

            <div class="dashboard-card">
                <h4>Top Matched Skills</h4>
                <ul class="matched-list">${matchedSkillsHtml}</ul>
            </div>

            <div class="dashboard-card">
                <h4 style="display:flex; align-items:center;">Missing Requirements ${iconWarning}</h4>
                <ul class="missing-list">${missingReqsHtml}</ul>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
};

// --- 🧰 CUSTOM TOAST MANAGER ---
window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;
    
    // SVG Icons mapping perfectly to your image reference
    const icons = {
        success: `<svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>`,
        error: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path stroke-linecap="round" stroke-linejoin="round" d="M15 9l-6 6m0-6l6 6"></path></svg>`,
        info: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path stroke-linecap="round" stroke-linejoin="round" d="M12 16v-4m0-4h.01"></path></svg>`,
        warning: `<svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`
    };

    const iconHtml = icons[type] || icons.info;

    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${iconHtml}</span>
            <p class="toast-message">${message}</p>
        </div>
        <button class="toast-close">&times;</button>
        <div class="toast-progress"></div>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
        dismissToast(toast);
    });

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) dismissToast(toast);
    }, 3000);
};

function dismissToast(toast) {
    toast.style.animation = 'toastSlideOut 0.2s ease-in forwards';
    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2000);
}