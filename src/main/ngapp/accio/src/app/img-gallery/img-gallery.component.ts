import { Component, OnInit, Inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormGroup, FormControl } from '@angular/forms';
import { PostBlobsService } from '../post-blobs.service';
import { ImageBlob } from '../ImageBlob';
import * as $ from 'jquery';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-img-gallery',
  templateUrl: './img-gallery.component.html',
  styleUrls: ['./img-gallery.component.css']
})
export class ImgGalleryComponent implements OnInit {
  uploadImageForm: FormGroup;
  formData: FormData;

  //  ProjectId is binded with the upload form input.
  projectId: string;

  displayUpload: boolean = false;
  displayImages: boolean = false;

  // Filters for fetching images
  imgName: string = '';
  maskName: string = '';
  withMasks: boolean = false;
  sortImg: string = '';
  sortMask: string = '';
  tag: string = '';

  //  Holds images fetched from datastore.
  imageArray: Array<any>;

  constructor(
    private route: ActivatedRoute,
    private postBlobsService: PostBlobsService,
    public dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.uploadImageForm = new FormGroup({
      imgName: new FormControl(),
      image: new FormControl(),
      tags: new FormControl()
    });

    //  Creates the form data of parameters to be sent to servlet.
    this.formData = new FormData();

    //  Set the project id, first try if the 
    //     project is a new project and there are query keys.
    this.route.queryParams.subscribe(params => {
      this.projectId = params['proj-id'];
    });
    //  If there are no keys then just get the url params.
    if (!this.projectId) {
      this.route.paramMap.subscribe(params => {
        this.projectId = params.get('proj-id');
      });
    }

    console.log('projID ' + this.projectId);
    console.log('now fetching...')

    //  Get the blobstore url initalized and show the form.
    this.postBlobsService.fetchBlob();
    this.displayUpload = true;
    this.getImages();
  }

  async getImages(): Promise<any> {
    console.log('fetching from projectId: ' + this.projectId);
    let fetchUrl = '/blobs?' + $.param({
      'proj-id': this.projectId,
      'img-name': this.imgName,
      'mask-name': this.maskName,
      'with-masks': this.withMasks,
      'sort-img': this.sortImg,
      'sort-mask': this.sortMask,
      'tag': this.tag
    });

    //  fetchUrl returns a list of image objects: 'url', 'name', 'utc', 'tags[]', 'masks[]'
    const response = await fetch(fetchUrl);
    const imageContent = await response.json();
    this.imageArray = imageContent;

    if (this.imageArray.length > 0) {
      this.displayImages = true;
    }
  }

 /** 
  *   Builds ImageBlob to be appended to form and posted.
  *   If a parameter isn't applicaple, it has a default value but must be filled
  *      if a value later in the constructor is applicable.
  */
  onSubmit() {
     // Name is a required input. If it's null, do nothing.
    if(!this.uploadImageForm.get('imgName').value) {
      return;
    }
    
    //  uploadImageForm 'image' contains a file, so the value is a file array.
    //  To serve the blob we have to access the first file in the array.
    const fileArray = this.uploadImageForm.get('image').value;
    const imageFile = fileArray.files[0];
    console.log(imageFile);

    let imageBlob = new ImageBlob(
      this.projectId, 
      /*imageName=*/this.uploadImageForm.get('imgName').value,
      /*mode=*/'create',
      /*image=*/imageFile,
      /*parentImageName=*/'', 
      /*newImageName=*/'',
      /*tags=*/this.uploadImageForm.get('tags').value,
      );

    this.postBlobsService.buildForm(this.formData, imageBlob, imageFile.name);

    //  Reset form values.
    this.uploadImageForm.reset;
  }

  // Opens up the dialog for updating the clicked image.
  updateButton(imageName: string, parentImageName: string): void {
    const dialogRef = this.dialog.open(UpdateImageDialog, {
      width: '600px',
      data: {projectId: this.projectId,
          imageName: imageName,
          parentImageName: parentImageName}
    });

    dialogRef.afterClosed().subscribe(() => {
      console.log('UpdateImage dialog was closed...');
      console.log('Fetching updated images...');
      this.getImages();
      console.log('Fetched updated images...');
    });
  }
}


/* Flow for dialog popup => UPDATING IMAGES */

export interface UpdateImageData {
  projectId: string;
  imageName: string;
  parentImageName: string;
}

/**Represents the dialog popup that appears when ImageGalleryComponent's
 * templateUrl calls the this.updateButton() function. 
 */
@Component({
  selector: 'update-image-dialog',
  templateUrl: 'update-image-dialog.html'
})
export class UpdateImageDialog {
  updateImageForm: FormGroup;
  formData: FormData;
  doDelete:boolean = false;

  constructor(
      private postBlobsService: PostBlobsService,
      public dialogRef: MatDialogRef<UpdateImageDialog>,
      @Inject(MAT_DIALOG_DATA) public data: UpdateImageData) { }

  ngOnInit(): void {
    this.updateImageForm = new FormGroup({
      updateImgName: new FormControl(),
      updateTags: new FormControl(),
      delete: new FormControl()
    });
    this.formData = new FormData();
  }

  /**Sends the form data to blobstore and then to /blobs servlet,
   * where the update to the image is saved in the database.
   */
  onUpdateImage(): void {
    let imageBlob = new ImageBlob(
      this.data.projectId, 
      /*imageName=*/this.data.imageName,
      /*mode=*/'update',
      /*image=*/undefined,
      /*parentImageName=*/this.data.parentImageName, 
      /*newImageName=*/this.updateImageForm.get('updateImgName').value,
      /*tags=*/this.updateImageForm.get('updateTags').value,
      /*delete=*/this.updateImageForm.get('delete').value
      );

    console.log(this.updateImageForm.get('delete').value);

    this.postBlobsService.buildForm(this.formData, imageBlob, '');

    //  Reset form values.
    this.updateImageForm.reset;
  }

  /**Closes dialog popup without changing or saving any edited values.
   */
  onNoClick(): void {
    this.dialogRef.close();
  }
}