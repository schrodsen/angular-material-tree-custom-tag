import { FlatTreeControl } from '@angular/cdk/tree'
import { Component, Injectable } from '@angular/core';
import { MatTreeFlatDataSource, MatTreeFlattener } from '@angular/material/tree';
import { of as observableOf, Observable, BehaviorSubject } from 'rxjs';
import { files } from './example_data';

/** File node data with nested structure. */
export interface FileNode {
  nodeId: string;
  name: string;
  type: string;
  counter: number;
  children?: FileNode[];
}

/** Flat node with expandable and level information */
export class TreeNode {
  name: string;
  type: string;
  level: number;
  expandable: boolean;
  counter: number;
}

/**
 * Update Type
 */
 export interface UpType {
  index: number;
  item: FileNode;
}

/**
 * Checklist database, it can build a tree structured Json object.
 * Each node in Json object represents a to-do item or a category.
 * If a node is a category, it has children items and new items can be added under the category.
 */
 @Injectable()
 export class TreeDatabase {
   dataChange: BehaviorSubject<FileNode[]> = new BehaviorSubject<FileNode[]>([]);
 
   get data(): FileNode[] { return this.dataChange.value; }
 
   constructor() {
     this.initialize();
   }
 
   initialize() {
     // Build the tree nodes from Json object. The result is a list of `TodoItemNode` with nested
     //     file node as children.
     const data = files
 
     // Notify the change.
     this.dataChange.next(data);
   }
 
   /** Add an item to to-do list */
   insertItem(parent: FileNode, label: string) {
     const child = <FileNode>{ name: label };
     
     if (parent.children) { 
       parent.children.push(child);
       this.dataChange.next(this.data);
     }
     else { 
       parent.children = [];
       parent.children.push(child);
       this.dataChange.next(this.data);
     }
   }
 
   removeRootItem(nodeId: string) {
    this.dataChange.next(this.data.filter(obj => obj.nodeId != nodeId));
   }

   removeChildItem(parent: FileNode, nodeId: string) {
    parent.children = parent.children.filter(obj => obj.nodeId !== nodeId)
    this.dataChange.next(this.data);
   }
 }

@Component({
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.css' ],
  providers: [TreeDatabase]
})
export class AppComponent {

  /** Map from flat node to nested node. This helps us finding the nested node to be modified */
  flatNodeMap: Map<TreeNode, FileNode> = new Map<TreeNode, FileNode>();

  /** Map from nested node to flattened node. This helps us to keep the same object for selection */
  nestedNodeMap: Map<FileNode, TreeNode> = new Map<FileNode, TreeNode>();

  /** The TreeControl controls the expand/collapse state of tree nodes.  */
  treeControl: FlatTreeControl<TreeNode>;

  /** The TreeFlattener is used to generate the flat list of items from hierarchical data. */
  treeFlattener: MatTreeFlattener<FileNode, TreeNode>;

  /** The MatTreeFlatDataSource connects the control and flattener to provide data. */
  dataSource: MatTreeFlatDataSource<FileNode, TreeNode>;

  /** The new item's name */
  newItemName = '';

  constructor(private database: TreeDatabase) {
    this.treeFlattener = new MatTreeFlattener(
      this.transformer,
      this.getLevel,
      this.isExpandable,
      this.getChildren);
  
    this.treeControl = new FlatTreeControl<TreeNode>(this.getLevel, this.isExpandable);
    this.dataSource = new MatTreeFlatDataSource(this.treeControl, this.treeFlattener);
    this.dataSource.data = files;

    database.dataChange.subscribe(data => {
      this.dataSource.data = data;
      // this.refreshTree();
    });
  }

  /** Transform the data to something the tree can read. */
  // transformer(node: FileNode, level: number) {

  //   return {
  //     name: node.name,
  //     type: node.type,
  //     level: level,
  //     expandable: !!node.children,
  //     counter: node.counter,
  //   };
  // }

  transformer = (node: FileNode, level: number) => {
    let flatNode = this.nestedNodeMap.has(node) && this.nestedNodeMap.get(node)!.name === node.name
      ? this.nestedNodeMap.get(node)!
      : new TreeNode();
    flatNode.name = node.name;
    flatNode.level = level;
    flatNode.counter = node.counter;
    flatNode.expandable = !!node.children;
    this.flatNodeMap.set(flatNode, node);
    this.nestedNodeMap.set(node, flatNode);
    return flatNode;
  }

 /** Get the level of the node */
  getLevel(node: TreeNode) {
    return node.level;
  }

  /** Return whether the node is expanded or not. */
  isExpandable(node: TreeNode) {
    return node.expandable;
  };

  /** Get the children for the node. */
  getChildren(node: FileNode) {
    return observableOf(node.children);
  }

  /** Get whether the node has children or not. */
  hasChild(index: number, node: TreeNode){
    return node.expandable;
  }

  /** Get whether the node is new. */
  hasNoContent = (_: number, _nodeData: TreeNode) => _nodeData.name === '';

  hasNoMedia = (_: number, _nodeData: TreeNode) => _nodeData.counter === 0 && _nodeData.expandable === false;

  refreshTree() {
    let _data = this.dataSource.data;
    this.dataSource.data = [];
    this.dataSource.data = _data;
  }

  addNewRoot() {
    let element = <HTMLElement> document.getElementById("newRoot");
    element.style.display = 'flex';
  }

  saveNewRootNode() {
    let element = <HTMLElement> document.getElementById("newRoot");
    element.style.display = 'none';

    const fileNode = <FileNode> { name: 'Test', counter: 0, type: 'folder' };
    this.database.data.push(fileNode);

    this.refreshTree();
  }

  addNewNode(node: TreeNode) {
    // Only allow one instance for a new node
    if (this.treeControl.dataNodes.findIndex(obj => obj.name === '') !== -1)
      return;

    const parentNode = this.flatNodeMap.get(node);
    // 
    let isParentHasChildren: boolean = false;
    if (parentNode.children)
      isParentHasChildren = true;
    //
    this.database.insertItem(parentNode!, '');
    // expand the subtree only if the parent has children (parent is not a leaf node)
    if (isParentHasChildren)
      this.treeControl.expand(node);
  }

  deleteNode(node: TreeNode) {
    const nodeId = this.flatNodeMap.get(node).nodeId;

    if (node.level === 0) {
      this.database.removeRootItem(nodeId);
     } else {
      let parentTreeNode = this.getParentNode(node);
      const parentFileNode = this.flatNodeMap.get(parentTreeNode);
      this.database.removeChildItem(parentFileNode, nodeId);
     }

    this.refreshTree();
  }

  saveNode(node: TreeNode) {
      console.log(node);
  }


  expandAll() {
    this.treeControl.expandAll();
  }

  collapseAll() {
    this.treeControl.collapseAll();
  }

  refresh() {
  }

  getParentNode(node: TreeNode): TreeNode | null {
    const currentLevel = this.getLevel(node);

    if (currentLevel < 1) {
      return null;
    }

    const startIndex = this.treeControl.dataNodes.indexOf(node) - 1;

    for (let i = startIndex; i >= 0; i--) {
      const currentNode = this.treeControl.dataNodes[i];

      if (this.getLevel(currentNode) < currentLevel) {
        return currentNode;
      }
    }
    return null;
  }
}