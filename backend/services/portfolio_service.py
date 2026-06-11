import chromadb
import uuid
from backend.core.config import settings
from backend.models.schemas import PortfolioItem

class PortfolioService:
    def __init__(self):
        # Initialize persistent ChromaDB client
        self.chroma_client = chromadb.PersistentClient(path=settings.CHROMADB_PATH)
        self.collection = self.chroma_client.get_or_create_collection(name="portfolio")

    def load_portfolio(self, items: list[PortfolioItem]):
        """
        Clears the collection and loads new tech stack -> links mappings.
        """
        # Clear existing elements
        count = self.collection.count()
        if count > 0:
            # Get all IDs and delete them
            results = self.collection.get()
            if results and 'ids' in results and results['ids']:
                self.collection.delete(ids=results['ids'])
                
        # Add new elements
        if not items:
            return
            
        documents = []
        metadatas = []
        ids = []
        
        for item in items:
            if not item.techstack or not item.links:
                continue
            documents.append(item.techstack)
            metadatas.append({"links": item.links})
            ids.append(str(uuid.uuid4()))
            
        if documents:
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )

    def query_links(self, skills: list[str], n_results: int = 2) -> list[str]:
        """
        Queries ChromaDB for relevant portfolio links matching specified skills.
        """
        if not skills:
            return []
            
        try:
            # Query the database
            results = self.collection.query(
                query_texts=skills,
                n_results=n_results
            )
            
            links = []
            metadatas_list = results.get('metadatas', [])
            
            for metadata_group in metadatas_list:
                for metadata in metadata_group:
                    if metadata and 'links' in metadata:
                        links.append(metadata['links'])
                        
            # Deduplicate links while maintaining order
            seen = set()
            deduped = []
            for link in links:
                if link not in seen:
                    seen.add(link)
                    deduped.append(link)
                    
            return deduped
        except Exception as e:
            print(f"[PortfolioService] Query error: {e}")
            return []
