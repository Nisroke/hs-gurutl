(async () => {
  try {
    console.log('확장 프로그램 시작');
    const response = await fetch(chrome.runtime.getURL("cards_United.json"));
    const rawData = await response.json();

    // 카드 DB를 dbfId 기준으로 정리
    const cardDataByDbfId = {};
    const koreanNameMap = new Map();
    const koreanNameIndex = []; // 검색 성능 향상을 위한 인덱스
    
    for (const setName in rawData) {
      const cardArray = rawData[setName];
      if (!Array.isArray(cardArray)) continue;

      cardArray.forEach(card => {
        if (card.dbfId && card.name) {
          cardDataByDbfId[card.dbfId] = card;
          koreanNameMap.set(card.name.toLowerCase(), card);
          koreanNameIndex.push({
            name: card.name.toLowerCase(),
            card: card
          });
        }
      });
    }

    // 이진 검색을 위해 정렬
    koreanNameIndex.sort((a, b) => a.name.localeCompare(b.name));

    console.log('카드 데이터 로드 완료');

    let observer = null;

    function findMatchingCards(query) {
      query = query.toLowerCase();
      const matches = [];
      
      // 이진 검색으로 시작 위치 찾기
      let start = 0;
      let end = koreanNameIndex.length;
      
      while (start < end) {
        const mid = Math.floor((start + end) / 2);
        if (koreanNameIndex[mid].name < query) {
          start = mid + 1;
        } else {
          end = mid;
        }
      }
      
      // 시작 위치부터 순차적으로 검사
      for (let i = start; i < koreanNameIndex.length; i++) {
        const item = koreanNameIndex[i];
        if (!item.name.startsWith(query)) break; // 시작 부분이 일치하지 않으면 중단
        matches.push(item.card);
        if (matches.length >= 10) break; // 최대 10개까지만 표시
      }
      
      return matches;
    }

    function createAutocompleteDropdown(searchInput) {
      const dropdownId = `korean-search-dropdown-${searchInput.getAttribute('data-phx-id') || Math.random().toString(36).substr(2, 9)}`;
      let dropdown = document.getElementById(dropdownId);
      
      if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = dropdownId;
        dropdown.className = 'korean-search-dropdown';
        
        if (!document.getElementById('korean-search-styles')) {
          const style = document.createElement('style');
          style.id = 'korean-search-styles';
          style.textContent = `
            .korean-search-dropdown {
              position: fixed;
              background: rgb(24, 26, 27);
              border: 1px solid #666;
              border-radius: 4px;
              max-height: 300px;
              overflow-y: auto;
              z-index: 99999;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              display: none;
              color: rgb(232, 230, 227);
            }
            .korean-search-item {
              padding: 8px 12px;
              cursor: pointer;
              border-bottom: 1px solid #666;
            }
            .korean-search-item:hover {
              background-color: rgb(35, 38, 39);
            }
            .korean-search-item:last-child {
              border-bottom: none;
            }
            .korean-search-item .name {
              font-weight: 500;
              color: rgb(232, 230, 227);
            }
            .korean-search-item .enname {
              font-size: 0.8em;
              color: rgb(232, 230, 227);
            }
          `;
          document.head.appendChild(style);
        }
        
        document.body.appendChild(dropdown);
      }

      // 드롭다운 위치 업데이트 함수
      function updateDropdownPosition() {
        const rect = searchInput.getBoundingClientRect();
        dropdown.style.width = rect.width + 'px';
        dropdown.style.left = rect.left + window.scrollX + 'px';
        dropdown.style.top = (rect.bottom + window.scrollY) + 'px';
      }

      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);

      return { dropdown, updateDropdownPosition };
    }

    function injectKoreanSearch() {
      const searchInputs = document.querySelectorAll('input[name="search[]"]');
      searchInputs.forEach(searchInput => {
        if (searchInput.hasAttribute('data-kr-search')) return;

        searchInput.setAttribute('data-kr-search', 'true');
        searchInput.setAttribute('placeholder', '카드 검색 (한글/영문)');

        const { dropdown, updateDropdownPosition } = createAutocompleteDropdown(searchInput);
        let isMouseOverDropdown = false;

        searchInput.addEventListener('input', function(e) {
          const query = e.target.value;
          
          if (/[가-힣]/.test(query)) {
            const matches = findMatchingCards(query);

            if (matches.length > 0) {
              if (matches.length === 1) {
                console.log('검색어:', query, '매칭:', matches[0].name);
              } else {
                console.log('검색어:', query, '매칭 수:', matches.length);
              }
              
              dropdown.innerHTML = matches.map(card => `
                <div class="korean-search-item">
                  <div class="name">${card.name}</div>
                  <div class="enname">${card.enname}</div>
                </div>
              `).join('');
              
              dropdown.style.display = 'block';
              updateDropdownPosition();
            } else {
              dropdown.style.display = 'none';
            }
          } else {
            dropdown.style.display = 'none';
          }
        });

        // 드롭다운 영역 마우스 이벤트
        dropdown.addEventListener('mouseenter', () => {
          isMouseOverDropdown = true;
        });

        dropdown.addEventListener('mouseleave', () => {
          isMouseOverDropdown = false;
        });

        // 자동완성 항목 클릭 처리
        dropdown.addEventListener('click', function(e) {
          const item = e.target.closest('.korean-search-item');
          if (item) {
            const cardName = item.querySelector('div:last-child').textContent;
            searchInput.value = cardName;
            dropdown.style.display = 'none';
            isMouseOverDropdown = false;
            
            // 사이트의 검색 이벤트 트리거
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            const form = searchInput.closest('form');
            if (form) {
              const changeEvent = form.getAttribute('phx-change');
              if (changeEvent) {
                const event = new CustomEvent('phx:change');
                form.dispatchEvent(event);
              }
            }
          }
        });

        // 검색창 외부 클릭시 드롭다운 닫기 (마우스가 드롭다운 위에 있지 않을 때만)
        document.addEventListener('click', function(e) {
          if (!searchInput.contains(e.target) && !dropdown.contains(e.target) && !isMouseOverDropdown) {
            dropdown.style.display = 'none';
          }
        });

        // ESC 키로 드롭다운 닫기
        searchInput.addEventListener('keydown', function(e) {
          if (e.key === 'Escape') {
            dropdown.style.display = 'none';
            isMouseOverDropdown = false;
          }
        });

        // 검색창 포커스시 드롭다운 표시
        searchInput.addEventListener('focus', function() {
          if (searchInput.value && /[가-힣]/.test(searchInput.value)) {
            dropdown.style.display = 'block';
            updateDropdownPosition();
          }
        });

        // 검색창 블러 이벤트 (마우스가 드롭다운 위에 있을 때는 닫지 않음)
        searchInput.addEventListener('blur', function(e) {
          setTimeout(() => {
            if (!isMouseOverDropdown) {
              dropdown.style.display = 'none';
            }
          }, 200);
        });
      });
    }

    function translateCards() {
      if (observer) observer.disconnect();

      // 검색 기능 주입
      injectKoreanSearch();

      const cardElements = document.querySelectorAll(
        "[phx-value-card_id], div[card_id], div.decklist_card_container, .dropdown-item[phx-value-value]"
      );

      cardElements.forEach(el => {
        let dbfId = null;

        if (el.hasAttribute("phx-value-card_id")) {
          dbfId = parseInt(el.getAttribute("phx-value-card_id"));
        } else if (el.hasAttribute("card_id")) {
          dbfId = parseInt(el.getAttribute("card_id"));
        } else if (el.classList.contains("decklist_card_container")) {
          const aTag = el.querySelector("a[href^='/card/']");
          if (aTag) {
            const match = aTag.getAttribute("href").match(/\/card\/(\d+)/);
            if (match) {
              dbfId = parseInt(match[1]);
            }
          }
        } else if (el.hasAttribute("phx-value-value")) {
          dbfId = parseInt(el.getAttribute("phx-value-value"));
        }

        if (!dbfId) return;

        const card = cardDataByDbfId[dbfId];
        if (!card) return;

        if (el.classList.contains("dropdown-item")) {
          if (card.name && card.enname) {
            el.innerHTML = `
              <span style="display: block;">${card.name}</span>
              <span style="display: block; font-size: 0.8em; color: #666;">${card.enname}</span>
            `;
          }
        } else {
          const nameSpan = el.querySelector(".card-name");
          if (nameSpan && card.name) {
            nameSpan.textContent = card.name;
          }
        }

        const bgDiv =
          el.querySelector(".decklist-card-image") ||
          el.querySelector(".decklist-card-tile");
        if (bgDiv && card.img) {
          bgDiv.style.backgroundImage = `url("${card.img}")`;
        }

        const imgTag = el.querySelector("img");
        if (imgTag) {
          if (card.img) imgTag.src = card.img;
          if (card.name) {
            imgTag.alt = card.name;
            imgTag.title = card.name;
          }
        }
      });

      if (observer) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }

    // 첫 실행
    translateCards();

    observer = new MutationObserver(() => {
      clearTimeout(window.__card_translate_timer);
      window.__card_translate_timer = setTimeout(() => {
        translateCards();
      }, 300);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  } catch (error) {
    console.error('확장 프로그램 오류:', error);
  }
})();
